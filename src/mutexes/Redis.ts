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
		global: (prefix?: string) => `${ prefix ? `${ prefix }:` : '' }global`,
		remaining: (route: string, prefix?: string) => `${ prefix ? `${ prefix }:` : '' }${route}:remaining`,
		limit: (route: string, prefix?: string) => `${ prefix ? `${ prefix }:` : '' }${route}:limit`,
	};

	constructor(public readonly redis: Redis, public readonly prefix?: string) {
		super();
		redis.defineCommand('gettimeout', {
			numberOfKeys: 3,
			lua: fs.readFileSync('./scripts/gettimeout.lua').toString(),
		});
	}

	public async set(route: string, limits: Partial<Ratelimit>): Promise<void> {
		const pipe = this.redis.pipeline();
		if (limits.timeout) {
			if (limits.global) pipe.set(RedisMutex.keys.global(this.prefix), true, 'px', limits.timeout);
			else pipe.pexpire(RedisMutex.keys.remaining(route, this.prefix), limits.timeout);
		}
		if (limits.limit) pipe.set(RedisMutex.keys.limit(route, this.prefix), limits.limit);
		await pipe.exec();
	}

	protected async getTimeout(route: string) {
		return this.redis.gettimeout(RedisMutex.keys.remaining(route, this.prefix), RedisMutex.keys.limit(route, this.prefix), RedisMutex.keys.global(this.prefix), 1e3);
	}
}
