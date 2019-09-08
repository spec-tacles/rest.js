import { Redis } from 'ioredis';
import RatelimitMutex, { Ratelimit } from './RatelimitMutex';
import fs = require('fs');


declare module 'ioredis' {
	interface Redis {
		gettimeout(key: string, limit: string, globalLimit: string, defaultTimeout: number): Promise<number>;
	}

	interface Pipeline {
		gettimeout(key: string, limit: string, globalLimit: string, defaultTimeout: number): this;
	}
}

export default class RedisMutex extends RatelimitMutex {
	public static readonly keys = {
		global: 'global',
		remaining: (route: string) => `${route}:remaining`,
		limit: (route: string) => `${route}:limit`,
	};

	constructor(public readonly redis: Redis) {
		super();
		redis.defineCommand('gettimeout', {
			numberOfKeys: 3,
			lua: fs.readFileSync('./scripts/gettimeout.lua').toString(),
		});
	}

	public async set(route: string, limits: Partial<Ratelimit>): Promise<void> {
		const pipe = this.redis.pipeline();
		if (limits.timeout) {
			if (limits.global) pipe.set(RedisMutex.keys.global, true, 'px', limits.timeout);
			else pipe.pexpire(RedisMutex.keys.remaining(route), limits.timeout);
		}
		if (limits.limit) pipe.set(RedisMutex.keys.limit(route), limits.limit);
		await pipe.exec();
	}

	protected async getTimeout(route: string) {
		return this.redis.gettimeout(RedisMutex.keys.remaining(route), RedisMutex.keys.limit(route), RedisMutex.keys.global, 1e3);
	}
}
