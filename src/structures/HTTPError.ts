import { Response } from 'node-fetch';

export enum InternalError {
	RETRY_LIMIT_EXCEEDED = 'Retry limit exceeded.',
	REQUEST_CANCELLED = 'Request was cancelled.',
}

export default class HTTPError extends Error {
	constructor(public readonly response: Response, body: string) {
		super(`${response.statusText}: ${body}`);
	}
}
