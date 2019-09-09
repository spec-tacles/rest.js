local global = redis.call('pttl', KEYS[3])
if global > 0 then return global end

local remaining = tonumber(redis.call('get', KEYS[1]))

if remaining == nil then
	local limit = tonumber(redis.call('get', KEYS[2]))
	if limit == nil then limit = 1 end

	redis.call('set', KEYS[1], limit - 1)
	return 0
end

local ttl = redis.call('pttl', KEYS[1])
if remaining <= 0 then
	if ttl <= 0 then return tonumber(ARGV[1])
	else return ttl end
end

redis.call('set', KEYS[1], remaining - 1)
if ttl > 0 then redis.call('pexpire', KEYS[1], ttl) end
return 0
