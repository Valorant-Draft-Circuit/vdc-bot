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
	return failure("IN_MATCH", { queueId = playerData.currentQueueId })
end

-- Allow players who are either actively queued or in the "completed" list to leave.
if status ~= "queued" and status ~= "completed" then
	return failure("NOT_QUEUED")
end

local tier = playerData.tier
-- queuePriority may be missing for players in the :completed list; default to empty string
-- so we can safely include it in XADD and skip strict validation.
local priority = playerData.queuePriority or ""
if tier == nil or tier == "" then
	return failure("TIER_UNKNOWN")
end

-- Determine which queue list(s) to remove the user from.
-- Prefer the explicit priority bucket if present; otherwise attempt all known
-- priority lists (including their :completed siblings) for the player's tier.
local function safeLRem(key, value)
	if key ~= nil and key ~= "" then
		pcall(function()
			redis.call("LREM", key, 0, value)
		end)
	end
end

local priorityUpper = (priority ~= nil and priority ~= "") and string.upper(tostring(priority)) or ""
if priorityUpper ~= "" then
	local target = "vdc:tier:" .. tier .. ":queue:" .. priorityUpper
	safeLRem(target, userId)
	-- Also remove from completed sibling just in case the player was moved there
	safeLRem(target .. ":completed", userId)
else
	-- Unknown priority: try removing from all known buckets for the tier.
	local buckets = { "DE", "FA", "RFA", "SIGNED" }
	for _, b in ipairs(buckets) do
		local k = "vdc:tier:" .. tier .. ":queue:" .. b
		safeLRem(k, userId)
		safeLRem(k .. ":completed", userId)
	end
end

redis.call("HSET", playerKey, "status", "idle")
redis.call("HDEL", playerKey, "queuePriority", "queueJoinedAt")
redis.call("PEXPIRE", playerKey, 43200000)

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
