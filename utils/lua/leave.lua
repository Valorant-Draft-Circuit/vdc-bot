local cjson = _G.cjson

--[[
Atomic queue leave script.

KEYS
  1 -> vdc:player:{userId}
  2 -> vdc:events
  3 -> vdc:league_state

ARGV
  1 -> userId
  2 -> timestamp (ms)
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

local userId = ARGV[1]
if userId == nil or userId == "" then
	return failure("MISSING_USER_ID")
end

local now = tonumber(ARGV[2])

local playerKey = KEYS[1]
local playerData = parseHash(redis.call("HGETALL", playerKey))

if next(playerData) == nil then
	return failure("NOT_QUEUED")
end

local status = playerData.status and string.lower(playerData.status)
if status == "in_match" then
	return failure("IN_MATCH", { matchId = playerData.currentMatchId })
end

if status ~= "queued" then
	return failure("NOT_QUEUED")
end

local tier = playerData.tier
local priority = playerData.queuePriority
if tier == nil or tier == "" then
	return failure("TIER_UNKNOWN")
end
if priority == nil or priority == "" then
	return failure("PRIORITY_UNKNOWN")
end

local queueKey
if priority == "DE" then
	queueKey = "vdc:tier:" .. tier .. ":queue:DE"
elseif priority == "FA_RFA" then
	queueKey = "vdc:tier:" .. tier .. ":queue:FA_RFA"
elseif priority == "SIGNED" then
	queueKey = "vdc:tier:" .. tier .. ":queue:SIGNED"
else
	return failure("PRIORITY_UNKNOWN", { priority = priority })
end

redis.call("LREM", queueKey, 0, userId)

redis.call("HSET", playerKey, "status", "idle")
redis.call("HDEL", playerKey, "queuePriority", "queueJoinedAt")

local eventsKey = KEYS[2]
local eventId = nil
if eventsKey ~= nil and eventsKey ~= "" then
	eventId = redis.call("XADD", eventsKey, "*",
		"type", "queue_leave",
		"userId", userId,
		"tier", tier,
		"priority", priority,
		"timestamp", tostring(now or 0)
	)
end

return success({
	userId = userId,
	tier = tier,
	priority = priority,
	eventId = eventId,
})
