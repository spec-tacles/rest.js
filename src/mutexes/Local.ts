import RatelimitMutex, { Ratelimit } from './RatelimitMutex';

export interface LocalRatelimit extends Ratelimit {
	expiresAt: Date;
}

export default class LocalMutex extends RatelimitMutex {
	public global?: Date;
	protected limits: Map<string, Partial<LocalRatelimit> & Pick<LocalRatelimit, 'remaining'>> = new Map();

	public set(route: string, newLimits: Partial<Ratelimit>): Promise<void> {
		let limit = this.limits.get(route);
		if (!limit) {
			limit = { remaining: -1 };
			this.limits.set(route, limit);
		}

		if (newLimits.timeout !== undefined) {
			const expiresAt = new Date(Date.now() + newLimits.timeout);
			if (newLimits.global) this.global = expiresAt;
			else limit.expiresAt = expiresAt;
		}

		limit.limit = newLimits.limit ?? 0;
		if (limit.remaining < 0 && newLimits.remaining !== undefined) limit.remaining = newLimits.remaining;
		return Promise.resolve();
	}

	protected getTimeout(route: string): Promise<number> {
		const globalExpiration = this.global?.valueOf() ?? 0;
		if (globalExpiration > Date.now()) return Promise.resolve(globalExpiration - Date.now());

		let ratelimit = this.limits.get(route);

		// prepare an empty ratelimit object
		if (!ratelimit) {
			ratelimit = { remaining: -1 };
			this.limits.set(route, ratelimit);
			return Promise.resolve(0);
		}

		// if we're currently ratelimited, return the time until we're not
		if (ratelimit.remaining <= 0) {
			if (ratelimit.expiresAt) {
				const ttl = Math.max(ratelimit.expiresAt.valueOf() - Date.now(), 0);
				return Promise.resolve(ttl);
			}

			return Promise.resolve(1e2);
		}

		ratelimit.remaining--;
		return Promise.resolve(0);
	}
}
