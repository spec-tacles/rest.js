import axios, { AxiosRequestConfig, AxiosResponse, AxiosAdapter } from 'axios';

function pause(n: number): Promise<void> {
  return new Promise(r => setTimeout(r, n));
}

/**
 * A class for ratelimiting things.
 */
export default class Bucket {
  /**
   * Whether we're globally ratelimited.
   * @type {boolean}
   * @default false
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
   * @type {number}
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

  public queue: Array<[
    AxiosRequestConfig,
    (value?: AxiosResponse | PromiseLike<AxiosResponse>) => void,
    (reason?: any) => void
  ]> = [];

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
   * Whether this queue has started.
   * @type {boolean}
   * @protected
   */
  protected _started: boolean = false;

  /**
   * Discord timestamp at which this bucket's ratelimits will be reset.
   * @type {number}
   * @protected
   */
  protected _reset: number = 0;

  /**
   * Time at which this ratelimit bucket resets, according to the Unix timestamp of your machine.
   * @returns {number}
   */
  public get reset() {
    return this._reset - Bucket.timeDiff;
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
    return (Bucket.global || this.remaining < 1) && (this.resetDistance > 0);
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
    Bucket.global = false;
    this.remaining = 1;
  }

  /**
   * Queue a request to be sent sequentially in this bucket.
   * @param {AxiosRequestConfig} config The request config to queue
   * @returns {Promise<AxiosResponse>}
   */
  public enqueue<T = any>(config: AxiosRequestConfig) {
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      this.queue.push([config, resolve, reject]);
      this._start();
    });
  }

  /**
   * Start the queue.
   * @protected
   * @returns {Promise<undefined>}
   */
  protected async _start() {
    if (this._started) return;
    this._started = true;

    let entry;
    while (entry = this.queue.shift()) {
      let [config, resolve, reject] = entry;

      // pause while limited
      while (this.limited) await pause(this.resetDistance);
      this.clear();

      // make request
      try {
        var res = await (axios.defaults.adapter as AxiosAdapter)(config);
      } catch (e) {
        reject(e);
        break;
      }
      const date = new Date(res.headers.date).valueOf();

      // set ratelimiting information
      Bucket.timeDiff = date - Date.now();
      Bucket.global = Boolean(res.headers['x-ratelimit-global']);
      this.limit = Number(res.headers['x-ratelimit-limit'] || Infinity);
      this.reset = Number(res.headers['x-ratelimit-reset'] || 0) * 1e3;
      this.remaining = Number(res.headers['x-ratelimit-remaining'] || 1);

      // retry on some errors
      if (res.status === 429) {
        this.reset = date + Number(res.headers['retry-after']) + Bucket.timeDiff;
        this.queue.push([config, resolve, reject]);
      } else if (res.status >= 500 && res.status < 600) {
        await pause(1e3 + Math.random() - 0.5);
        this.queue.push([config, resolve, reject]);
      } else {
        resolve(res);
      }
    }

    this._started = false;
  }
}
