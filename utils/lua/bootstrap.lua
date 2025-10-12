local cjson = _G.cjson

local leagueKey = KEYS[1]
local tiersKey = KEYS[2]

local leagueState = ARGV[1]
local tiersJson = ARGV[2] or "[]"

if not leagueState or leagueState == "" then
	return cjson.encode({ ok = false, error = "MISSING_LEAGUE_STATE" })
end

redis.call("SET", leagueKey, leagueState)

local tiers
local success, decoded = pcall(cjson.decode, tiersJson)
if success and type(decoded) == "table" then
	tiers = decoded
else
	tiers = {}
end

redis.call("DEL", tiersKey)

local total = 0
for _, entry in ipairs(tiers) do
	if type(entry) == "table" and entry.name then
		local name = tostring(entry.name)
		local openValue = entry.open and "1" or "0"
		redis.call("SADD", tiersKey, name)
		redis.call("SET", "vdc:tier:" .. name .. ":open", openValue)
		total = total + 1
	end
end

return cjson.encode({ ok = true, league = leagueState, tiers = total })
