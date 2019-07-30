import RatelimitStore, { Ratelimits, DEFAULT_LIMITS } from './RatelimitStore';

export default class LocalStore implements RatelimitStore {
	protected limits: Map<string, Ratelimits> = new Map();

	public get(route: string): Promise<Ratelimits> {
		let limits = this.limits.get(route);
		if (!limits) {
			limits = DEFAULT_LIMITS;
			this.limits.set(route, limits);
		}
		return Promise.resolve(limits);
	}

	public set(route: string, newLimits: Partial<Ratelimits>): Promise<void> {
		let limits = this.limits.get(route);
		if (!limits) {
			limits = Object.assign({}, DEFAULT_LIMITS);
			this.limits.set(route, limits);
		}

		for (const [key, value] of Object.entries(newLimits)) (limits as any)[key] = value;
		return Promise.resolve();
	}

	public clear(route: string): Promise<void> {
		this.limits.delete(route);
		return Promise.resolve();
	}
}
