import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import RatelimitStore, { Ratelimits } from '../stores/RatelimitStore';

function pause(n: number): Promise<void> {
  return new Promise(r => setTimeout(r, n));
}

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

  public static limited(limits: Ratelimits): boolean {
    return (limits.global || limits.remaining < 1) && (limits.timeout > 0);
  }

  public queue: Array<{
    config: AxiosRequestConfig,
    resolve: (value?: AxiosResponse | PromiseLike<AxiosResponse>) => void,
    reject: (reason?: any) => void,
  }> = [];

  /**
   * Whether this queue has started.
   * @type {boolean}
   * @protected
   */
  protected _started: boolean = false;

  constructor(protected store: RatelimitStore, public readonly route: string) {}

  public get(): Promise<Ratelimits> {
    return this.store.get(this.route);
  }

  public set(limits: Partial<Ratelimits>): Promise<void> {
    return this.store.set(this.route, limits);
  }

  /**
   * Clear ratelimits.
   * @returns {Promise<void>}
   */
  public clear() {
    return this.store.clear(this.route);
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
      const limits = await this.get();

      // pause while limited
      if (Bucket.limited(limits)) await pause(limits.timeout);
      await this.clear();

      // make request
      try {
        var res = await axios.defaults.adapter!(entry.config);
      } catch (e) {
        entry.reject(e);
        continue;
      }

      const date = new Date(res.headers.date).valueOf();
      const {
        'x-ratelimit-global': globally,
        'x-ratelimit-limit': limit,
        'x-ratelimit-reset': reset,
        'x-ratelimit-remaining': remaining,
      } = res.headers;

      // set ratelimiting information
      await this.set({
        global: Boolean(globally),
        limit: Number(limit || Infinity),
        remaining: Number(remaining || 1),
        timeout: reset ? (Number(reset) * 1e3) - date : 0
      });

      // retry on some errors
      if (res.status === 429) {
        console.error(new Date(), 'encountered 429');
        await this.set({ timeout: Number(res.headers['retry-after'] || 0) });
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
