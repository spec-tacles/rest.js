import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

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
      Bucket.global = Boolean(globally);
      this.limit = Number(limit || Infinity);
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
