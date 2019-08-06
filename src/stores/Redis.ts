import { Redis } from 'ioredis';
import fs = require('fs');
import RatelimitMutex, { Ratelimits } from './RatelimitMutex';

function pause(n: number): Promise<void> {
  return new Promise(r => setTimeout(r, n));
}

declare module 'ioredis' {
	interface Redis {
		gettimeout(key: string, limit: string, defaultTimeout: number): Promise<number>;
	}

	interface Pipeline {
		gettimeout(key: string, limit: string, defaultTimeout: number): this;
	}
}

export default class RedisStore implements RatelimitMutex {
	public static readonly keys = {
		remaining: (route: string) => `${route}:remaining`,
		limit: (route: string) => `${route}:limit`,
	};

	constructor(public readonly redis: Redis) {
		redis.defineCommand('gettimeout', {
			numberOfKeys: 2,
			lua: fs.readFileSync('./scripts/gettimeout.lua').toString(),
		});
	}

	public async claim(route: string): Promise<void> {
		let timeout = await this.getTimeout(route);
		while (timeout > 0) {
			await pause(timeout);
			timeout = await this.getTimeout(route);
		}
	}

	public async set(route: string, limits: Partial<Ratelimits>): Promise<void> {
		const pipe = this.redis.pipeline();
		if (limits.timeout) pipe.pexpire(RedisStore.keys.remaining(route), limits.timeout);
		if (limits.limit) pipe.set(RedisStore.keys.limit(route), limits.limit);
		await pipe.exec();
	}

	private getTimeout(route: string) {
		return this.redis.gettimeout(RedisStore.keys.remaining(route), RedisStore.keys.limit(route), 1e3);
	}
}
