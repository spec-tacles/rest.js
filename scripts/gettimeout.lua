local remaining = tonumber(redis.call('get', KEYS[1]))

if remaining == nil then
	local limit = tonumber(redis.call('get', KEYS[2]))
	if limit == nil then limit = 1 end

	redis.call('set', KEYS[1], limit - 1)
	return 0
end

local ttl = redis.call('pttl', KEYS[1])
if remaining <= 0 then
	if ttl < 0 then return tonumber(ARGV[1])
	else return ttl end
else
	if ttl < 0 then redis.call('set', KEYS[1], remaining - 1)
	else redis.call('set', KEYS[1], remaining - 1, 'px', ttl) end
	return 0
end
