local cjson = _G.cjson

--[[
Apply an admin MMR change to a player's live queue state.

A queued player keeps their spot when the new MMR stays in the same tier, and moves to the back of
the new tier's queue when it doesn't. Players in a match are left alone: the match keeps the tier it
was built with and submits normally, and the new MMR is picked up on their next join. Idle players
have nothing to update.

KEYS
	1 -> vdc:player:{userId}
	2 -> vdc:tier:{newTier}:open
	3 -> vdc:tiers

ARGV
	1 -> userId
	2 -> new tier
	3 -> new mmr
	4 -> current timestamp in milliseconds
	5 -> "closed" when queue config closes the new tier (optional)
]]

local function respond(payload)
	return cjson.encode(payload or {})
end

local function isTruthy(value)
	local normalized = string.lower(tostring(value))
	return normalized == "1"
		or normalized == "true"
		or normalized == "yes"
		or normalized == "open"
		or normalized == "enabled"
end

local playerKey = KEYS[1]
local userId = ARGV[1]
local newTier = ARGV[2]
local newMmr = ARGV[3]
local now = ARGV[4]

local fields = redis.call("HMGET", playerKey, "status", "tier", "queuePriority", "currentQueueId")
local status = fields[1] and string.lower(fields[1]) or nil
local oldTier = fields[2]

if status == "in_match" then
	return respond({ state = "in_match", queueId = fields[4] })
end
if status ~= "queued" or not oldTier then
	return respond({ state = "not_queued" })
end

if oldTier == newTier then
	redis.call("HSET", playerKey, "mmr", newMmr)
	return respond({ state = "same_tier", tier = newTier })
end

-- take them out of every list in the old tier, remembering whether they were in a :completed list
local completed = false
for _, bucket in ipairs({ "DE", "FA", "RFA", "SIGNED" }) do
	local base = "vdc:tier:" .. oldTier .. ":queue:" .. bucket
	redis.call("LREM", base, 0, userId)
	if redis.call("LREM", base .. ":completed", 0, userId) > 0 then
		completed = true
	end
end

-- a missing open key counts as open, matching join.lua
local openValue = redis.call("GET", KEYS[2])
local tierOpen = (openValue == false or isTruthy(openValue)) and ARGV[5] ~= "closed"
if not tierOpen then
	redis.call("HSET", playerKey, "status", "idle", "mmr", newMmr)
	redis.call("HDEL", playerKey, "queuePriority", "queueJoinedAt")
	return respond({ state = "removed_tier_closed", from = oldTier, to = newTier })
end

local bucket = string.upper(tostring(fields[3] or "DE"))
local listKey = "vdc:tier:" .. newTier .. ":queue:" .. bucket
if completed then
	listKey = listKey .. ":completed"
end

-- LPUSH is the back of the line; the matchmaker reads from the other end
redis.call("LPUSH", listKey, userId)
redis.call("HSET", playerKey, "tier", newTier, "mmr", newMmr, "queueJoinedAt", now)
redis.call("PEXPIRE", playerKey, 43200000)
redis.call("SADD", KEYS[3], newTier)

return respond({ state = "moved", from = oldTier, to = newTier })
