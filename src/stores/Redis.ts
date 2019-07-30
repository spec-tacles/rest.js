import { Redis } from 'ioredis';
import RatelimitStore, { Ratelimits, DEFAULT_LIMITS } from './RatelimitStore';

export default class RedisStore implements RatelimitStore {
	private static keys(route: string) {
		return Object.keys(DEFAULT_LIMITS).map(suff => route + suff);
	}

	constructor(public readonly redis: Redis) {}

	public async get(route: string): Promise<Ratelimits> {
		const limits: string[] = await this.redis.mget(...RedisStore.keys(route));
		return Promise.resolve({
			global: limits[0] === 'false' ? false : limits[0] === 'true' ? true : DEFAULT_LIMITS.global,
			limit: Number(limits[1] || DEFAULT_LIMITS.limit),
			timeout: Number(limits[2] || DEFAULT_LIMITS.timeout),
			remaining: Number(limits[3] || DEFAULT_LIMITS.remaining),
		});
	}

	public async set(route: string, limits: Partial<Ratelimits>): Promise<void> {
		await this.redis.mset(...Object.entries(limits).flatMap(([key, val]) => [route + key, val]));
	}

	public async clear(route: string): Promise<void> {
		await this.redis.del(...RedisStore.keys(route));
	}
}
