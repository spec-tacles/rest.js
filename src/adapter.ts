import axios, { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';

export const limiters: Map<string, Ratelimiter> = new Map();

/**
 * A class for ratelimiting things.
 */
export class Ratelimiter {
  /**
   * Whether we're globally ratelimited.
   * @type {boolean=false}
   * @static
   */
  public static global: boolean = false;

  /**
   * An array of time differences calculated from HTTP requests. Limited to size of 10.
   * @type {number[]}
   * @private
   * @static
   */
  private static _timeDiffs: number[] = [];

  /**
   * Time difference between local client and remote server. Numbers > 0 indicate the remote server is ahead of your
   * time. This number is averaged across the last 10 requests.
   * @returns {number}
   * @static
   */
  public static get timeDiff() {
    return this._timeDiffs.reduce((a, b) => a + b, 0) / this._timeDiffs.length;
  }

  public static set timeDiff(data: number) {
    this._timeDiffs.unshift(data);
    if (this._timeDiffs.length > 10) this._timeDiffs.pop();
  }

  /**
   * The total number of requests that can be made.
   * @type {number}
   */
  public limit: number = Infinity;

  /**
   * Requests remaining in this ratelimit bucket.
   * @type {number}
   */
  public remaining: number = 1;

  /**
   * Discord timestamp at which this bucket's ratelimits will be reset.
   * @type {number}
   */
  private _reset: number = 0;

  /**
   * Time at which this ratelimit bucket resets, according to the Unix timestamp of your machine.
   * @returns {number}
   */
  public get reset() {
    return this._reset - Ratelimiter.timeDiff;
  }

  /**
   * Time at which this ratelimit bucker resets, according to a Discord timestamp.
   * @param {number} data The timestamp to set
   */
  public set reset(data: number) {
    this._reset = data;
  }

  /**
   * Whether this bucket is currently ratelimited.
   * @returns {boolean}
   */
  public get limited() {
    return (Ratelimiter.global || this.remaining < 1) && (this.resetDistance > 0);
  }

  /**
   * The time distance until being un-ratelimited, accounting for server time differences.
   * @returns {number}
   */
  public get resetDistance() {
    return this.reset - Date.now();
  }

  /**
   * Clear ratelimits.
   * @returns {undefined}
   */
  public clear() {
    Ratelimiter.global = false;
    this.remaining = 1;
  }

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
}

function pause(n: number): Promise<void> {
  return new Promise(r => setTimeout(r, n));
}

/**
 * Make an Axios adapter that automatically handles ratelimits.
 * @param {Client} client The client for which to make this adapter
 * @returns {AxiosAdapter}
 */
export default async function adapt(config: AxiosRequestConfig): Promise<AxiosResponse> {
  // configure route and ratelimiter
  const route = Ratelimiter.makeRoute(config.method || 'get', config.url || '');
  let limiter = limiters.get(route);
  if (!limiter) {
    limiter = new Ratelimiter();
    limiters.set(route, limiter);
  }

  // pause while limited
  while (limiter.limited) await pause(limiter.resetDistance);
  limiter.clear();

  // make request
  const res = await (axios.defaults.adapter as AxiosAdapter)(config);
  const date = new Date(res.headers.date).valueOf();

  // set ratelimiting information
  Ratelimiter.timeDiff = date - Date.now();
  Ratelimiter.global = Boolean(res.headers['x-ratelimit-global']);
  limiter.limit = Number(res.headers['x-ratelimit-limit'] || Infinity);
  limiter.reset = Number(res.headers['x-ratelimit-reset'] || 0) * 1e3;
  limiter.remaining = Number(res.headers['x-ratelimit-remaining'] || 1);

  // retry on some errors
  if (res.status === 429) {
    limiter.reset = date + Number(res.headers['retry-after']) + Ratelimiter.timeDiff;
    return adapt(config);
  } else if (res.status >= 500 && res.status < 600) {
    await pause(1e3 + Math.random() - 0.5);
    return adapt(config);
  }

  return res;
}
