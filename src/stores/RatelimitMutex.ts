export interface Ratelimits {
	global: boolean;
	limit: number;
	timeout: number;
	remaining: number;
}

export const DEFAULT_LIMITS = Object.freeze({ global: false, limit: 1, timeout: 0, remaining: 1 });

export default interface RatelimitMutex {
	claim(route: string): Promise<void>;
	set(route: string, limits: Partial<Ratelimits>): Promise<void>;
}
