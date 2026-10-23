local cjson = _G.cjson

--[[
Atomic release of a queue match's players.

Only players whose hash still points at this match (status in_match, currentQueueId = queueId) have
their status changed. A late or repeated release (two teammates submitting at once, a cancel vote
landing after a submit, an admin kill of an old match) used to reset every listed player to idle,
which stranded anyone who had already re-queued or been placed in a newer match.

KEYS
	1 -> vdc:match:{queueId}

ARGV
	1 -> queueId
	2 -> mode
		complete -> mark the match completed and unlock its players; fails ALREADY_COMPLETED on repeats
		cancel   -> unlock its players and delete the match
		requeue  -> put its players back at the front of the lists they were popped from and delete
		            the match; only for a match whose lobby was never set up (status pending)
	3 -> current timestamp in milliseconds
	4 -> complete: tracker url (optional)
	5 -> complete: recent set TTL in seconds (0 disables the anti-rematch sets)
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

local function decodeArray(payload)
	if type(payload) ~= "string" or payload == "" then
		return {}
	end
	local ok, decoded = pcall(cjson.decode, payload)
	if not ok or type(decoded) ~= "table" then
		return {}
	end
	return decoded
end

local PLAYER_TTL_MS = 43200000
local VALID_BUCKETS = { DE = true, FA = true, RFA = true, SIGNED = true }

local matchKey = KEYS[1]
local queueId = ARGV[1]
local mode = ARGV[2]
local now = tonumber(ARGV[3]) or 0

if queueId == nil or queueId == "" then
	return failure("MISSING_MATCH_ID")
end
if mode ~= "complete" and mode ~= "cancel" and mode ~= "requeue" then
	return failure("INVALID_MODE", { mode = mode })
end

local match = parseHash(redis.call("HGETALL", matchKey))
if next(match) == nil then
	return failure("MATCH_NOT_FOUND", { queueId = queueId })
end
if mode == "complete" and match.status == "completed" then
	return failure("ALREADY_COMPLETED", { queueId = queueId })
end
if mode == "requeue" and match.status ~= "pending" then
	return failure("MATCH_NOT_PENDING", { queueId = queueId, status = match.status })
end

local players = {}
local seen = {}
for _, team in ipairs({ decodeArray(match.teamAJSON), decodeArray(match.teamBJSON) }) do
	for _, id in ipairs(team) do
		if type(id) == "string" and id ~= "" and not seen[id] then
			seen[id] = true
			table.insert(players, id)
		end
	end
end

local function playerKey(id)
	return "vdc:player:" .. id
end

local function isBound(id)
	local fields = redis.call("HMGET", playerKey(id), "status", "currentQueueId")
	return fields[1] == "in_match" and fields[2] == queueId
end

local function unlock(key)
	redis.call("HSET", key, "status", "idle")
	redis.call("HDEL", key, "queuePriority", "queueJoinedAt", "currentQueueId")
end

local released = {}
local skipped = {}

if mode == "complete" then
	redis.call("HSET", matchKey, "status", "completed", "endedAt", tostring(now))
	if ARGV[4] ~= nil and ARGV[4] ~= "" then
		redis.call("HSET", matchKey, "trackerUrl", ARGV[4])
	end

	local recentTtl = tonumber(ARGV[5]) or 0
	for _, id in ipairs(players) do
		local key = playerKey(id)
		if isBound(id) then
			unlock(key)
			table.insert(released, id)
		else
			table.insert(skipped, id)
		end

		-- everyone listed played the game, bound or not; a missing hash is left alone so the count
		-- falls back to the database cache instead of restarting at 1
		if redis.call("EXISTS", key) == 1 then
			redis.call("HINCRBY", key, "gameCount", 1)
		end

		if recentTtl > 0 then
			local recentKey = key .. ":recent"
			for _, otherId in ipairs(players) do
				if otherId ~= id then
					redis.call("SADD", recentKey, otherId)
				end
			end
			redis.call("EXPIRE", recentKey, recentTtl)
		end
	end
elseif mode == "cancel" then
	for _, id in ipairs(players) do
		local key = playerKey(id)
		if isBound(id) then
			unlock(key)
			redis.call("DEL", key .. ":recent")
			redis.call("PEXPIRE", key, PLAYER_TTL_MS)
			table.insert(released, id)
		else
			table.insert(skipped, id)
		end
	end

	redis.call("DEL",
		matchKey,
		matchKey .. ":cancel_votes_yes",
		matchKey .. ":cancel_votes_no",
		matchKey .. ":cancel_active",
		matchKey .. ":cancel_message_id"
	)
else
	local details = {}
	for _, entry in ipairs(decodeArray(match.playersJSON)) do
		if type(entry) == "table" and type(entry.id) == "string" then
			details[entry.id] = entry
		end
	end

	local function joinedAt(id)
		return tonumber(details[id] and details[id].joinedAt) or now
	end

	-- the matchmaker reads lists from the RPUSH end, so push the newest first and the
	-- longest-waiting player ends up back at the very front
	table.sort(players, function(a, b)
		return joinedAt(a) > joinedAt(b)
	end)

	local tier = match.tier
	for _, id in ipairs(players) do
		local key = playerKey(id)
		local entry = details[id] or {}
		local bucket = string.upper(tostring(entry.bucket or ""))

		if not isBound(id) then
			table.insert(skipped, id)
		elseif tier ~= nil and tier ~= "" and VALID_BUCKETS[bucket] then
			local listKey = "vdc:tier:" .. tier .. ":queue:" .. bucket
			if entry.completed == true then
				listKey = listKey .. ":completed"
			end
			redis.call("LREM", listKey, 0, id)
			redis.call("RPUSH", listKey, id)
			redis.call("HSET", key,
				"status", "queued",
				"tier", tier,
				"queuePriority", bucket,
				"queueJoinedAt", tostring(joinedAt(id))
			)
			redis.call("HDEL", key, "currentQueueId")
			redis.call("PEXPIRE", key, PLAYER_TTL_MS)
			table.insert(released, id)
		else
			-- can't tell which list they came from; unlocking beats leaving them stuck in_match
			unlock(key)
			redis.call("PEXPIRE", key, PLAYER_TTL_MS)
			table.insert(released, id)
		end
	end

	redis.call("DEL", matchKey)
end

return success({
	queueId = queueId,
	mode = mode,
	tier = match.tier,
	players = players,
	released = released,
	skipped = skipped,
})
