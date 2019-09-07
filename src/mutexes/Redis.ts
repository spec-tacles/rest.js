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
		global: (token: string) => `${ token.replace(/\./g, '') }:global`,
		remaining: (route: string, token: string) => `${ token.replace(/\./g, '') }:${route}:remaining`,
		limit: (route: string, token: string) => `${ token.replace(/\./g, '') }:${route}:limit`,
	};

	constructor(public readonly redis: Redis) {
		super();
		redis.defineCommand('gettimeout', {
			numberOfKeys: 3,
			lua: fs.readFileSync('./scripts/gettimeout.lua').toString(),
		});
	}

	public async set(route: string, limits: Partial<Ratelimit>, token: string): Promise<void> {
		const pipe = this.redis.pipeline();
		if (limits.timeout) {
			if (limits.global) pipe.set(RedisMutex.keys.global(token), true, 'px', limits.timeout);
			else pipe.pexpire(RedisMutex.keys.remaining(route, token), limits.timeout);
		}
		if (limits.limit) pipe.set(RedisMutex.keys.limit(route, token), limits.limit);
		await pipe.exec();
	}

	protected async getTimeout(route: string, token: string) {
		return this.redis.gettimeout(RedisMutex.keys.remaining(route, token), RedisMutex.keys.limit(route, token), RedisMutex.keys.global(token), 1e3);
	}
}
