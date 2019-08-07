import { Redis } from 'ioredis';
import fs = require('fs');
import RatelimitMutex, { Ratelimit } from './RatelimitMutex';
import { pause } from '../util';


declare module 'ioredis' {
	interface Redis {
		gettimeout(key: string, limit: string, globalLimit: string, defaultTimeout: number): Promise<number>;
	}

	interface Pipeline {
		gettimeout(key: string, limit: string, globalLimit: string, defaultTimeout: number): this;
	}
}

export default class RedisStore implements RatelimitMutex {
	public static readonly keys = {
		global: 'global',
		remaining: (route: string) => `${route}:remaining`,
		limit: (route: string) => `${route}:limit`,
	};

	constructor(public readonly redis: Redis) {
		redis.defineCommand('gettimeout', {
			numberOfKeys: 3,
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

	public async set(route: string, limits: Partial<Ratelimit>): Promise<void> {
		const pipe = this.redis.pipeline();
		if (limits.timeout) {
			if (limits.global) pipe.set(RedisStore.keys.global, true, 'px', limits.timeout);
			else pipe.pexpire(RedisStore.keys.remaining(route), limits.timeout);
		}
		if (limits.limit) pipe.set(RedisStore.keys.limit(route), limits.limit);
		await pipe.exec();
	}

	private async getTimeout(route: string) {
		return this.redis.gettimeout(RedisStore.keys.remaining(route), RedisStore.keys.limit(route), RedisStore.keys.global, 1e3);
	}
}
