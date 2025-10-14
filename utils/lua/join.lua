local cjson = _G.cjson

--[[
Atomic queue join script for Combines queues.

KEYS
  1 -> vdc:league_state
  2 -> vdc:tier:{tier}:open
  3 -> vdc:tier:{tier}:queue:DE
  4 -> vdc:tier:{tier}:queue:FA_RFA
  5 -> vdc:tier:{tier}:queue:SIGNED
  6 -> vdc:player:{userId}
  7 -> vdc:events

ARGV
  1 -> userId (Discord snowflake)
  2 -> tier identifier
  3 -> priority bucket (DE | FA_RFA | SIGNED)
  4 -> eligibility status (DRAFT_ELIGIBLE | FREE_AGENT | RESTRICTED_FREE_AGENT | SIGNED)
  5 -> current timestamp in milliseconds (optional; defaults to Redis TIME)
  6 -> mmr (number as string)
  7 -> guildId (Discord guild snowflake)
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

local function isTruthy(value)
	if value == nil then
		return false
	end

	local normalized = toLower(value)
	return normalized == "1"
		or normalized == "true"
		or normalized == "yes"
		or normalized == "open"
		or normalized == "enabled"
end

local function currentTimeMillis(provided)
	local numeric = tonumber(provided)
	if numeric ~= nil then
		return numeric
	end

	local redisTime = redis.call("TIME")
	return (redisTime[1] * 1000) + math.floor(redisTime[2] / 1000)
end

local userId = ARGV[1]
if userId == nil or userId == "" then
	return failure("MISSING_USER_ID")
end

local tier = ARGV[2]
if tier == nil or tier == "" then
	return failure("MISSING_TIER")
end

local bucket = ARGV[3]
if bucket == nil or bucket == "" then
	return failure("MISSING_PRIORITY_BUCKET")
end

local eligibility = ARGV[4] or ""
local now = currentTimeMillis(ARGV[5])
local mmr = tonumber(ARGV[6]) or 0
local guildId = ARGV[7] or ""

local leagueState = toLower(redis.call("GET", KEYS[1]) or "")
if leagueState ~= "combines" then
    return failure("LEAGUE_STATE_NOT_COMBINES", { league = leagueState })
end

local tierOpenValue = redis.call("GET", KEYS[2])
if tierOpenValue == false or tierOpenValue == nil then
	tierOpenValue = "1"
end

if not isTruthy(tierOpenValue) then
	return failure("TIER_CLOSED", { tier = tier, value = tierOpenValue })
end

local queueKey
local bucketUpper = string.upper(bucket)
local priorityIndex

if bucketUpper == "DE" then
    queueKey = KEYS[3]
	priorityIndex = "DE"
elseif bucketUpper == "FA_RFA" then
    queueKey = KEYS[4]
	priorityIndex = "FA_RFA"
elseif bucketUpper == "SIGNED" then
    queueKey = KEYS[5]
	priorityIndex = "SIGNED"
else
	return failure("INVALID_PRIORITY_BUCKET", { bucket = bucket })
end

if queueKey == nil or queueKey == "" then
	return failure("MISSING_QUEUE_KEY", { bucket = bucketUpper })
end

local playerKey = KEYS[6]
local playerData = parseHash(redis.call("HGETALL", playerKey))

local previousStatusRaw = playerData.status
local status = toLower(previousStatusRaw)
if status == "queued" then
	return failure("ALREADY_QUEUED", { tier = playerData.tier, priority = playerData.queuePriority })
elseif status == "in_match" then
	return failure("IN_MATCH", { matchId = playerData.currentMatchId })
elseif status == "locked" then
	return failure("PLAYER_LOCKED")
end

local existingCooldown = tonumber(playerData.cooldownUntil)
if existingCooldown ~= nil and existingCooldown > now then
	return failure("ON_COOLDOWN", { cooldownUntil = existingCooldown })
end

local queueKeys = { KEYS[3], KEYS[4], KEYS[5] }
for _, key in ipairs(queueKeys) do
	if key ~= nil and key ~= "" then
		local existingIndex = redis.call("LPOS", key, userId)
		if existingIndex ~= false and existingIndex ~= nil then
			return failure("DUPLICATE_IN_QUEUE", { list = key })
		end
	end
end

local queueDepth = redis.call("LPUSH", queueKey, userId)

redis.call("HSET", playerKey,
	"status", "queued",
	"tier", tier,
	"queuePriority", priorityIndex,
	"eligibilityStatus", eligibility,
	"queueJoinedAt", tostring(now),
    "mmr", tostring(mmr),
	"guildId", guildId
)
redis.call("PEXPIRE", playerKey, 43200000)
redis.call("HDEL", playerKey, "currentMatchId")

local eventsKey = KEYS[7]
local eventId = nil
if eventsKey ~= nil and eventsKey ~= "" then
	eventId = redis.call("XADD", eventsKey, "*",
		"type", "queue_join",
		"userId", userId,
		"tier", tier,
		"priority", priorityIndex,
		"eligibility", eligibility,
		"timestamp", tostring(now),
        "mmr", tostring(mmr),
		"guildId", guildId
 	)
end

return success({
	userId = userId,
	tier = tier,
	priority = priorityIndex,
	queueKey = queueKey,
	queueDepth = queueDepth,
	eventId = eventId,
	timestamp = now,
	previousStatus = previousStatusRaw or "idle",
	cooldownUntil = existingCooldown,
    mmr = mmr,
	guildId = guildId,
})
