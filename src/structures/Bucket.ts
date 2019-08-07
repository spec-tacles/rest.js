import RatelimitMutex, { Ratelimit } from '../stores/RatelimitMutex';
import { pause } from '../util';
import Rest from '../Rest';
import Request from '../Request';

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

  public static limited(limits: Ratelimit): boolean {
    return (limits.global || limits.remaining < 1) && (limits.timeout < 0);
  }

  public queue: Array<{
    req: Request,
    resolve: (value?: any | PromiseLike<any>) => void,
    reject: (reason?: any) => void,
  }> = [];

  /**
   * Whether this queue has started.
   * @type {boolean}
   * @protected
   */
  protected _started: boolean = false;

  constructor(public readonly rest: Rest, public readonly route: string) {}

  public get mutex(): RatelimitMutex {
    return this.rest.options.mutex;
  }

  /**
   * Queue a request to be sent sequentially in this bucket.
   * @param {AxiosRequestConfig} config The request config to queue
   * @returns {Promise<AxiosResponse>}
   */
  public async enqueue<T = any>(req: Request): Promise<T | Buffer> {
    await this.mutex.claim(this.route);

    const res = await this.rest.do(req);
    const date = new Date(res.headers.get('date')!);
    const secs = Math.floor(date.valueOf() / 1000);
    const globally = res.headers.get('x-ratelimit-global');
    const limit = res.headers.get('x-ratelimit-limit');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');

    // set ratelimiting information
    await this.mutex.set(this.route, {
      global: Boolean(globally),
      limit: Number(limit || Infinity),
      remaining: Number(remaining || 1),
      timeout: (Number(reset || secs) - secs) * 1000,
    });

    // retry on some errors
    if (res.status === 429) {
      console.error(new Date(), 'encountered 429');
      await this.mutex.set(this.route, { timeout: Number(res.headers.get('retry-after') || 0) });
      return this.enqueue(req);
    } else if (res.status >= 500 && res.status < 600) {
      await pause(1e3 + Math.random() - 0.5);
      return this.enqueue(req);
    }

    if (res.headers.get('content-type') === 'application/json') return res.json();
    return res.blob();
  }
}
