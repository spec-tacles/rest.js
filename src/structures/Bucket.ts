import fetch, { Response } from 'node-fetch';
import RatelimitMutex, { Ratelimit } from '../mutexes/RatelimitMutex';
import Events from '../types/Events';
import Request from '../types/Request';
import { RetryReason } from '../types/Retry';
import { pause } from '../util';
import HTTPError, { InternalError } from './HTTPError';
import Rest from './Rest';

/**
 * A class for ratelimiting things.
 */
export default class Bucket {
	/**
	 * Make a route that can be used as a ratelimit bucket key.
	 * from https://github.com/abalabahaha/eris
	 * @param method The HTTP method
	 * @param url The URL for which to create a route
	 * @returns {string}
	 * @static
	 */
	public static makeRoute(method: string, url: string): string {
		let route = url
			.replace(/\/([a-z-]+)\/(?:[0-9]{17,19})/g, (match, p) => {
				return p === 'channels' || p === 'guilds' || p === 'webhooks' ? match : `/${p}/:id`;
			})
			.replace(/\/reactions\/[^/]+/g, '/reactions/:id')
			.replace(/^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/, '/webhooks/$1/:token')
			.replace(/\?.*$/, '');

		if (method === 'delete' && route.endsWith('/messages/:id')) { // Delete Messsage endpoint has its own ratelimit
				route = method + route;
		}

		return route;
	}

	constructor(public readonly rest: Rest, public readonly route: string) {}

	public get mutex(): RatelimitMutex {
		return this.rest.options.mutex;
	}

	/**
	 * Queue a request to be sent sequentially in this bucket.
	 * @param {AxiosRequestConfig} config The request config to queue
	 * @returns {Promise<AxiosResponse>}
	 */
	public async make(req: Request): Promise<any> {
		await this.mutex.claim(this.route, req.signal);

		Rest.setHeader(req, 'X-Ratelimit-Precision', 'millisecond');
		this.rest.emit(Events.REQUEST, req);
		const res = await fetch(this.rest.makeURL(req.endpoint!), req);

		const globally = res.headers.get('x-ratelimit-global');
		const limit = res.headers.get('x-ratelimit-limit');
		const resetAfter = res.headers.get('x-ratelimit-reset-after');
		const remaining = res.headers.get('x-ratelimit-remaining');

		const ratelimit: Partial<Ratelimit> = {};
		if (globally) ratelimit.global = globally === 'true';
		if (limit) ratelimit.limit = Number(limit);
		if (resetAfter) ratelimit.timeout = Number(resetAfter) * 1000;
		if (remaining) ratelimit.remaining = Number(remaining);
		this.rest.emit(Events.RESPONSE, req, res.clone(), ratelimit);

		// set ratelimiting information
		await this.mutex.set(this.route, ratelimit);

		// retry on some errors
		if (res.status === 429) {
			let delay: number;
			const retry = res.headers.get('retry-after');
			if (retry) {
				const retryInt = parseInt(retry, 10);

				// Discord gives retry-after in ms (non-compliant with HTTP).
				// CloudFlare gives retry-after in seconds (compliant).
				// This may be changed in the future.

				if (isNaN(retryInt)) {
					// if the retry-after isn't a number, assume it's a date
					delay = new Date(retry).valueOf() - Date.now(); // CF retry-after, in HTTP date
				} else if (res.headers.has('via')) {
					// CF does not send a Via header, so this is probably a response from Discord.
					delay = retryInt; // Discord retry-after, in ms
				} else {
					delay = retryInt * 1e3; // CF retry-after, in seconds
				}
			} else {
				// some sane defaults if there's no retry-after
				delay = ratelimit.timeout ?? 1e3;
			}

			this.rest.emit(Events.RETRY, {
				reason: RetryReason.RATELIMIT,
				delay,
				request: req,
				response: res.clone(),
				ratelimit,
			});

			if (delay !== ratelimit.timeout) await this.mutex.set(this.route, { timeout: delay });
			return this.retry(req, res);
		} else if (res.status >= 500 && res.status < 600) {
			const delay = 1e3 + Math.random() - 0.5;
			this.rest.emit(Events.RETRY, {
				reason: RetryReason.SERVER_ERROR,
				delay,
				request: req,
				response: res.clone(),
				ratelimit,
			});

			await pause(delay);
			return this.retry(req, res);
		}

		if (!res.ok) throw new HTTPError(res.clone(), await res.text());
		if (res.headers.get('content-type') === 'application/json') return res.json();
		return res.blob();
	}

	protected async retry(req: Request, res: Response): Promise<any> {
		if (req.failures) req.failures++;
		else req.failures = 1;

		if (req.failures > this.rest.options.retryLimit) throw new HTTPError(res, InternalError.RETRY_LIMIT_EXCEEDED);
		return this.make(req);
	}
}
