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
      .replace(/^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/, '/webhooks/$1/:token');

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
    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetAfter = res.headers.get('x-ratelimit-reset-after');

    const ratelimit: Partial<Ratelimit> = {};
    if (globally) ratelimit.global = globally === 'true';
    if (limit) ratelimit.limit = Number(limit);
    if (remaining) ratelimit.remaining = Number(remaining);
    if (resetAfter) ratelimit.timeout = Number(resetAfter) * 1000;
    this.rest.emit(Events.RESPONSE, req, res, ratelimit);

    // set ratelimiting information
    await this.mutex.set(this.route, ratelimit);

    // retry on some errors
    if (res.status === 429) {
      const delay = Number(res.headers.get('retry-after') || 0);
      this.rest.emit(Events.RETRY, {
        reason: RetryReason.RATELIMIT,
        delay,
        request: req,
        response: res,
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
        response: res,
        ratelimit,
      });

      await pause(delay);
      return this.retry(req, res);
    }

    if (!res.ok) throw new HTTPError(res, await res.text());
    if (res.headers.get('content-type') === 'application/json') return res.json();
    return res.blob();
  }

  protected async retry<T>(req: Request, res: Response): Promise<T | Buffer> {
    if (req.failures) req.failures++;
    else req.failures = 1;

    if (req.failures > this.rest.options.retryLimit) throw new HTTPError(res, InternalError.RETRY_LIMIT_EXCEEDED);
    return this.make(req);
  }
}
