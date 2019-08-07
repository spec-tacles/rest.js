import RatelimitMutex, { Ratelimit } from './RatelimitMutex';
import { pause } from '../util';

export interface LocalRatelimit {
	expiresAt: Date;
	limit: number;
	remaining: number;
}

export default class LocalMutex implements RatelimitMutex {
	public global?: Date;
	protected limits: Map<string, Partial<LocalRatelimit>> = new Map();

	public async claim(route: string): Promise<void> {
		let timeout = await this.getTimeout(route);
		while (timeout > 0) {
			await pause(timeout);
			timeout = await this.getTimeout(route);
		}
	}

	public set(route: string, limits: Partial<Ratelimit>): Promise<void> {
		let local = this.limits.get(route);
		if (!local) {
			local = {};
			this.limits.set(route, local);
		}

		if (limits.timeout) {
			const expiresAt = new Date(Date.now() + limits.timeout);
			if (limits.global) {
				this.global = expiresAt;
			} else {
				this.global = undefined;
				local.expiresAt = expiresAt;
			}
		}

		if (limits.limit) local.limit = limits.limit;
		return Promise.resolve();
	}

	private getTimeout(route: string): Promise<number> {
		if (this.global) return Promise.resolve(this.global.valueOf() - Date.now());

		let ratelimit = this.limits.get(route);
		if (!ratelimit) {
			ratelimit = {};
			this.limits.set(route, ratelimit);
		}

		if (ratelimit.expiresAt && ratelimit.expiresAt.valueOf() <= Date.now()) {
			ratelimit.expiresAt = undefined;
			ratelimit.remaining = undefined;
		}

		if (ratelimit.remaining === undefined) {
			if (ratelimit.limit === undefined) ratelimit.limit = 1;
			ratelimit.remaining = ratelimit.limit - 1;
			return Promise.resolve(0);
		}

		if (ratelimit.remaining <= 0) {
			if (ratelimit.expiresAt) return Promise.resolve(ratelimit.expiresAt.valueOf() - Date.now());
			return Promise.resolve(1e3);
		}

		ratelimit.remaining--;
		return Promise.resolve(0);
	}
}
