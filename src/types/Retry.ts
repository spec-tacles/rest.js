import { Request, Response } from 'node-fetch';
import { Ratelimit } from '../mutexes/RatelimitMutex';

export enum RetryReason {
	RATELIMIT,
	SERVER_ERROR,
}

export default interface Retry {
	reason: RetryReason;
	delay: number;
	request: Request;
	response: Response;
	ratelimit: Ratelimit;
}