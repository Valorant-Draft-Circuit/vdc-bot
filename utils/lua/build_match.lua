local cjson = _G.cjson

--[[
KEYS
	1 -> vdc:league_state
	2 -> vdc:tier:{tier}:queue:DE
	3 -> vdc:tier:{tier}:queue:FA_RFA
	4 -> vdc:tier:{tier}:queue:SIGNED
	5 -> vdc:match:{queueId}
	6 -> vdc:events stream key (optional)
	7 -> vdc:tier:{tier}:queue:DE:completed (optional)
	8 -> vdc:tier:{tier}:queue:FA_RFA:completed (optional)
	9 -> vdc:tier:{tier}:queue:SIGNED:completed (optional)
  5 -> vdc:match:{queueId}
  6 -> vdc:events stream key (optional)

ARGV
  1 -> tier identifier
  2 -> queueId
  3 -> current timestamp (ms) (optional)
  4 -> relax window (seconds, default 180)
  5 -> recent set TTL (seconds, default relax window)
  6 -> max candidates per bucket scan (default 400)
  7 -> players per team (default 5)
]]

local function respond(payload)
	return cjson.encode(payload or {})
end

local function success(body)
	body.ok = true
	return respond(body)
end

local function failure(code, details)
	local body = { ok = false, error = code }
	if details ~= nil then
		body.details = details
	end
	return respond(body)
end

local function parseHash(flat)
	local obj = {}
	for i = 1, #flat, 2 do
		obj[flat[i]] = flat[i + 1]
	end
	return obj
end

local function toLower(value)
	if value == nil then
		return nil
	end
	return string.lower(tostring(value))
end

local function currentTimeMillis(provided)
	local numeric = tonumber(provided)
	if numeric ~= nil then
		return numeric
	end
	local redisTime = redis.call("TIME")
	return (redisTime[1] * 1000) + math.floor(redisTime[2] / 1000)
end

local KEY_LEAGUE_STATE = KEYS[1]
local KEY_QUEUE_DE = KEYS[2]
local KEY_QUEUE_FA = KEYS[3]
local KEY_QUEUE_SIGNED = KEYS[4]
local KEY_MATCH = KEYS[5]
local KEY_EVENTS = KEYS[6]
local KEY_QUEUE_DE_COMPLETED = KEYS[7]
local KEY_QUEUE_FA_COMPLETED = KEYS[8]
local KEY_QUEUE_SIGNED_COMPLETED = KEYS[9]

local tier = ARGV[1]
if tier == nil or tier == "" then
	return failure("MISSING_TIER")
end

local queueId = ARGV[2]
if queueId == nil or queueId == "" then
	return failure("MISSING_MATCH_ID")
end

local nowMs = currentTimeMillis(ARGV[3])
local relaxSeconds = tonumber(ARGV[4]) or 180
if relaxSeconds < 0 then
	relaxSeconds = 0
end
local relaxWindowMs = relaxSeconds * 1000

local recentTtlSeconds = tonumber(ARGV[5])
if recentTtlSeconds == nil then
	recentTtlSeconds = relaxSeconds
end
if recentTtlSeconds < 0 then
	recentTtlSeconds = 0
end

local maxScanPerBucket = tonumber(ARGV[6])
if maxScanPerBucket == nil or maxScanPerBucket <= 0 then
	maxScanPerBucket = 400
end

local playersPerTeam = tonumber(ARGV[7]) or 5
if playersPerTeam < 1 then
	playersPerTeam = 5
end
local totalRequired = playersPerTeam * 2

local leagueState = toLower(redis.call("GET", KEY_LEAGUE_STATE) or "")
if leagueState ~= "combines" then
	return failure("LEAGUE_STATE_NOT_COMBINES", { league = leagueState })
end

if redis.call("EXISTS", KEY_MATCH) == 1 then
	return failure("MATCH_ALREADY_EXISTS", { queueId = queueId })
end

local queueLengths = {
	DE = tonumber(redis.call("LLEN", KEY_QUEUE_DE)) or 0,
	FA_RFA = tonumber(redis.call("LLEN", KEY_QUEUE_FA)) or 0,
	SIGNED = tonumber(redis.call("LLEN", KEY_QUEUE_SIGNED)) or 0,
}
-- include completed lists in total queued counts if present
if KEY_QUEUE_DE_COMPLETED ~= nil and KEY_QUEUE_DE_COMPLETED ~= "" then
	queueLengths.DE = queueLengths.DE + (tonumber(redis.call("LLEN", KEY_QUEUE_DE_COMPLETED)) or 0)
end
if KEY_QUEUE_FA_COMPLETED ~= nil and KEY_QUEUE_FA_COMPLETED ~= "" then
	queueLengths.FA_RFA = queueLengths.FA_RFA + (tonumber(redis.call("LLEN", KEY_QUEUE_FA_COMPLETED)) or 0)
end
if KEY_QUEUE_SIGNED_COMPLETED ~= nil and KEY_QUEUE_SIGNED_COMPLETED ~= "" then
	queueLengths.SIGNED = queueLengths.SIGNED + (tonumber(redis.call("LLEN", KEY_QUEUE_SIGNED_COMPLETED)) or 0)
end
local totalQueued = queueLengths.DE + queueLengths.FA_RFA + queueLengths.SIGNED
if totalQueued < totalRequired then
	return failure("INSUFFICIENT_QUEUE", {
		required = totalRequired,
		total = totalQueued,
		DE = queueLengths.DE,
		FA_RFA = queueLengths.FA_RFA,
		SIGNED = queueLengths.SIGNED,
	})
end

local queueMetas = {
	{ name = "DE", key = KEY_QUEUE_DE, completed = KEY_QUEUE_DE_COMPLETED },
	{ name = "FA_RFA", key = KEY_QUEUE_FA, completed = KEY_QUEUE_FA_COMPLETED },
	{ name = "SIGNED", key = KEY_QUEUE_SIGNED, completed = KEY_QUEUE_SIGNED_COMPLETED },
}

local playerCache = {}
local earliestQueuedAt = nil

local function playerHashKey(userId)
	return "vdc:player:" .. userId
end

local function playerRecentKey(userId)
	return "vdc:player:" .. userId .. ":recent"
end

local function getPlayerData(userId)
	if playerCache[userId] ~= nil then
		return playerCache[userId]
	end
	local data = parseHash(redis.call("HGETALL", playerHashKey(userId)))
	playerCache[userId] = data
	return data
end

local function updateEarliest(joinAt)
	if joinAt == nil then
		return
	end
	if earliestQueuedAt == nil or joinAt < earliestQueuedAt then
		earliestQueuedAt = joinAt
	end
end

local function shouldConsiderRecent(ignoreRecent, selected, candidateId)
	if ignoreRecent then
		return false
	end
	for _, entry in ipairs(selected) do
		local selectedId = entry.id
		if redis.call("SISMEMBER", playerRecentKey(selectedId), candidateId) == 1
			or redis.call("SISMEMBER", playerRecentKey(candidateId), selectedId) == 1 then
			return true
		end
	end
	return false
end

-- selectPlayers performs a two-pass scan to enforce priority ordering.
-- First pass scans the primary queues in order (DE, FA_RFA, SIGNED).
-- Second pass scans the completed sibling lists (DE:completed, FA_RFA:completed, SIGNED:completed).
-- This ensures active (non-completed) players are always preferred over completed ones
-- while preserving the DE > FA_RFA > SIGNED precedence.
local function selectPlayers(ignoreRecent)
	local selection = {}
	local selectionLookup = {}
	local cleanup = {}
	local blockedRecent = 0

	local function scanBucketList(bucket, useCompleted)
		local listKey = bucket.key
		if useCompleted then
			if bucket.completed == nil or bucket.completed == "" then
				return
			end
			listKey = bucket.completed
		end
		local queueItems = redis.call("LRANGE", listKey, 0, -1)
		local queueSize = #queueItems
		if queueSize <= 0 then
			return
		end
		local limit = queueSize
		if maxScanPerBucket > 0 then
			limit = math.min(queueSize, maxScanPerBucket)
		end
		local startIndex = queueSize - limit + 1
		if startIndex < 1 then
			startIndex = 1
		end

		for idx = queueSize, startIndex, -1 do
			if #selection >= totalRequired then
				break
			end
			local userId = queueItems[idx]
			if userId and userId ~= "" and not selectionLookup[userId] then
				local playerData = getPlayerData(userId)
				if next(playerData) == nil then
					table.insert(cleanup, { key = listKey, value = userId })
				else
					local status = toLower(playerData.status)
					local playerTier = playerData.tier
					local joinAt = tonumber(playerData.queueJoinedAt) or nowMs

					if status ~= "queued" then
						table.insert(cleanup, { key = listKey, value = userId })
					elseif playerTier ~= nil and playerTier ~= tier then
						table.insert(cleanup, { key = listKey, value = userId })
					else
						updateEarliest(joinAt)
						if shouldConsiderRecent(ignoreRecent, selection, userId) then
							blockedRecent = blockedRecent + 1
						else
							selectionLookup[userId] = true
							table.insert(selection, {
								id = userId,
								bucket = bucket.name,
								queueKey = listKey,
								joinedAt = joinAt,
								eligibility = playerData.eligibilityStatus or "",
								cooldownUntil = playerData.cooldownUntil,
								mmr = tonumber(playerData.mmr) or 0,
								guildId = playerData.guildId,
								completed = useCompleted and true or false,
							})
						end
					end
				end
			end
		end
	end

	-- First pass: scan primary queues only (DE, FA_RFA, SIGNED)
	for _, bucket in ipairs(queueMetas) do
		scanBucketList(bucket, false)
		if #selection >= totalRequired then
			break
		end
	end

	-- Second pass: scan completed lists (DE:completed, FA_RFA:completed, SIGNED:completed)
	if #selection < totalRequired then
		for _, bucket in ipairs(queueMetas) do
			scanBucketList(bucket, true)
			if #selection >= totalRequired then
				break
			end
		end
	end

	return selection, cleanup, blockedRecent
end

local function applyCleanup(cleanupList, tracker)
	local removed = 0
	for _, entry in ipairs(cleanupList) do
		local key = entry.key
		local value = entry.value
		if key and value and value ~= "" then
			local fingerprint = key .. "|" .. value
			if tracker[fingerprint] == nil then
				tracker[fingerprint] = true
				removed = removed + (tonumber(redis.call("LREM", key, 0, value)) or 0)
			end
		end
	end
	return removed
end

local cleanupTracker = {}
local cleanupRemoved = 0

local selection, cleanupList, blockedRecentInitial = selectPlayers(false)
cleanupRemoved = cleanupRemoved + applyCleanup(cleanupList, cleanupTracker)

local relaxEligible = false
if earliestQueuedAt ~= nil and (nowMs - earliestQueuedAt) >= relaxWindowMs then
	relaxEligible = true
end

local relaxApplied = false
if #selection < totalRequired and relaxEligible then
	selection, cleanupList = selectPlayers(true)
	cleanupRemoved = cleanupRemoved + applyCleanup(cleanupList, cleanupTracker)
	relaxApplied = true
end

if #selection < totalRequired then
	local remainingDetails = {
		selected = #selection,
		required = totalRequired,
		DE = queueLengths.DE,
		FA_RFA = queueLengths.FA_RFA,
		SIGNED = queueLengths.SIGNED,
		relaxApplied = relaxApplied,
		relaxEligible = relaxEligible,
		blockedRecentInitial = blockedRecentInitial,
		earliestQueueJoin = earliestQueuedAt,
		relaxReadyAt = earliestQueuedAt and (earliestQueuedAt + relaxWindowMs) or nil,
		cleanupRemoved = cleanupRemoved,
	}
	return failure("MATCH_BUILD_INCOMPLETE", remainingDetails)
end

local bucketCounts = { DE = 0, FA_RFA = 0, SIGNED = 0 }
for _, entry in ipairs(selection) do
    bucketCounts[entry.bucket] = (bucketCounts[entry.bucket] or 0) + 1
end

for _, entry in ipairs(selection) do
    redis.call("LREM", entry.queueKey, 0, entry.id)
end

table.sort(selection, function(a, b)
    return (a.mmr or 0) > (b.mmr or 0)
end)

local teamA = {}
local teamB = {}
local sumA = 0
local sumB = 0

for _, entry in ipairs(selection) do
    local mmr = entry.mmr or 0
    if #teamA < playersPerTeam and (#teamB >= playersPerTeam or sumA <= sumB) then
        table.insert(teamA, entry.id)
        entry.team = "A"
        sumA = sumA + mmr
    else
        table.insert(teamB, entry.id)
        entry.team = "B"
        sumB = sumB + mmr
    end
end

local playersDetailed = {}
local matchGuildId = nil
for _, entry in ipairs(selection) do
	local waitMs = nowMs - (entry.joinedAt or nowMs)
    if waitMs < 0 then
        waitMs = 0
    end
    if matchGuildId == nil and entry.guildId ~= nil and entry.guildId ~= "" then
        matchGuildId = entry.guildId
    end
    table.insert(playersDetailed, {
        id = entry.id,
        bucket = entry.bucket,
        eligibility = entry.eligibility,
        joinedAt = entry.joinedAt,
        waitMs = waitMs,
        mmr = entry.mmr,
        team = entry.team,
        guildId = entry.guildId,
		completed = entry.completed and true or false,
    })
end

-- NOTE: recent set updates (anti-rematch bookkeeping) were previously applied here during match creation.
-- That logic has been intentionally removed so that recent sets are applied when a match is submitted
-- (to avoid marking players as "recent" for the duration of long-running matches). See submission handler.

for _, entry in ipairs(selection) do
	local key = playerHashKey(entry.id)
	redis.call("HSET", key,
		"status", "in_match",
		"currentQueueId", queueId,
		"lastMatchAt", tostring(nowMs),
		"queuePriority", entry.bucket
	)
	redis.call("HDEL", key, "queueJoinedAt")
	redis.call("PEXPIRE", key, 43200000)
end

redis.call("HSET", KEY_MATCH,
	"tier", tier,
	"status", "pending",
	"createdAt", tostring(nowMs),
	"teamAJSON", cjson.encode(teamA),
	"teamBJSON", cjson.encode(teamB),
	"playersJSON", cjson.encode(playersDetailed),
	"channelIdsJSON", "{}",
	"guildId", matchGuildId or "",
	"teamMmrJSON", cjson.encode({ teamA = sumA, teamB = sumB })
)
redis.call("HSET", KEY_MATCH,
	"relaxed", relaxApplied and "1" or "0",
	"playersPerTeam", tostring(playersPerTeam)
)

local eventId = nil
if KEY_EVENTS ~= nil and KEY_EVENTS ~= "" then
	local eventFields = {
		"type", "match_created",
		"queueId", queueId,
		"tier", tier,
		"timestamp", tostring(nowMs),
		"relaxed", relaxApplied and "1" or "0",
		"teamA", cjson.encode(teamA),
		"teamB", cjson.encode(teamB),
		"players", cjson.encode(playersDetailed),
		"bucket_de", tostring(bucketCounts.DE or 0),
		"bucket_fa_rfa", tostring(bucketCounts.FA_RFA or 0),
		"bucket_signed", tostring(bucketCounts.SIGNED or 0),
	}
	eventId = redis.call("XADD", KEY_EVENTS, "*", unpack(eventFields))
end

local remainingQueues = {
	DE = tonumber(redis.call("LLEN", KEY_QUEUE_DE)) or 0,
	FA_RFA = tonumber(redis.call("LLEN", KEY_QUEUE_FA)) or 0,
	SIGNED = tonumber(redis.call("LLEN", KEY_QUEUE_SIGNED)) or 0,
}

local response = {
    queueId = queueId,
    tier = tier,
    relaxed = relaxApplied,
    teamA = teamA,
    teamB = teamB,
    players = playersDetailed,
    queueRemaining = remainingQueues,
    queueCleaned = cleanupRemoved,
    eventId = eventId,
    createdAt = nowMs,
    earliestQueueJoin = earliestQueuedAt or cjson.null,
    playersPerTeam = playersPerTeam,
    blockedRecentInitial = blockedRecentInitial,
    relaxEligible = relaxEligible,
    guildId = matchGuildId,
    teamMmr = { teamA = sumA, teamB = sumB },
}

return success(response)
