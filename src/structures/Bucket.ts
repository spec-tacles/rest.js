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
    if (this._timeDiffs.length > 10) this._timeDiffs.length = 10;
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

  public queue: Array<{
    config: AxiosRequestConfig,
    resolve: (value?: AxiosResponse | PromiseLike<AxiosResponse>) => void,
    reject: (reason?: any) => void,
  }> = [];

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
   * The time to wait before retrying, in milliseconds.
   * @type {number}
   */
  public timeout: number = 0;

  /**
   * Whether this queue has started.
   * @type {boolean}
   * @protected
   */
  protected _started: boolean = false;

  /**
   * Whether this bucket is currently ratelimited.
   * @returns {boolean}
   */
  public get limited() {
    return (Bucket.global || this.remaining < 1) && (this.timeout > 0);
  }

  /**
   * Clear ratelimits.
   * @returns {undefined}
   */
  public clear() {
    Bucket.global = false;
    this.remaining = 1;
    this.timeout = 0;
  }

  /**
   * Queue a request to be sent sequentially in this bucket.
   * @param {AxiosRequestConfig} config The request config to queue
   * @returns {Promise<AxiosResponse>}
   */
  public enqueue<T = any>(config: AxiosRequestConfig) {
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      this.queue.push({ config, resolve, reject });
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
      // pause while limited
      if (this.limited) await pause(this.timeout);
      this.clear();

      // make request
      try {
        var res = await (axios.defaults.adapter as AxiosAdapter)(entry.config);
      } catch (e) {
        entry.reject(e);
        continue;
      }

      const date = new Date(res.headers.date).valueOf();
      const {
        'x-ratelimit-global': global,
        'x-ratelimit-limit': limit,
        'x-ratelimit-reset': reset,
        'x-ratelimit-remaining': remaining,
      } = res.headers;

      // set ratelimiting information
      Bucket.timeDiff = date - Date.now();
      Bucket.global = Boolean(global);
      this.limit = Number(global || Infinity);
      this.timeout = reset ? (Number(reset) * 1e3) - date : 0;
      this.remaining = Number(remaining || 1);

      // retry on some errors
      if (res.status === 429) {
        this.timeout = Number(res.headers['retry-after'] || 0);
        this.queue.push(entry);
      } else if (res.status >= 500 && res.status < 600) {
        await pause(1e3 + Math.random() - 0.5);
        this.queue.push(entry);
      } else {
        entry.resolve(res);
      }
    }

    this._started = false;
  }
}
