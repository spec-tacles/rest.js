export interface Ratelimit {
	global: boolean;
	limit: number;
	timeout: number;
	remaining: number;
}

export default interface RatelimitMutex {
	claim(route: string): Promise<void>;
	set(route: string, limits: Partial<Ratelimit>): Promise<void>;
}
