import { reflectors } from '../util';
import { AxiosInstance, AxiosRequestConfig } from 'axios';

export type ChainableQuery = Query & QueryObject;
export interface QueryObject {
  [key: string]: ChainableQuery
};

/**
 * @typedef ChainableQuery
 * @type {Query|Object<string, Query>}
 */

/**
 * An interface for making REST requests to the Discord API.
 */
export default class Query {
  public rest: AxiosInstance;

  /**
   * The routing keys of this query. For example, ['guilds', 'id'] translates to `/guilds/id`.
   * @type {string[]}
   * @readonly
   */
  public readonly keys: string[] = [];

  /**
   * Whether this query is frozen (ie. whether the endpoint can change).
   * @type {boolean}
   */
  public frozen: boolean = false;

  public post!: <T = any>(data: any, options?: AxiosRequestConfig) => Promise<T>;
  public get!: <T = any>(options?: AxiosRequestConfig) => Promise<T>;
  public put!: <T = any>(data: any, options?: AxiosRequestConfig) => Promise<T>;
  public patch!: <T = any>(data: any, options?: AxiosRequestConfig) => Promise<T>;
  public delete!: <T = any>(options?: AxiosRequestConfig) => Promise<T>;

  /**
   * @constructor
   * @param {Client} client The client to make this query with.
   * @param {string} start The base of the endpoint of this query.
   */
  constructor(rest: AxiosInstance, start: string) {
    this.rest = rest;
    this.keys = [start];

    for (const prop of ['post', 'get', 'put', 'patch', 'delete'] as ['post', 'get', 'put', 'patch', 'delete']) this[prop] = this._bind(prop);
  }

  /**
   * The endpoint to make this request to.
   * @returns {string}
   */
  public get endpoint() {
    return `/${this.keys.join('/')}`;
  }

  /**
   * Freeze this query.
   * @returns {true}
   */
  public freeze() {
    return this.frozen = true;
  }

  protected _bind(prop: 'get' | 'post' | 'patch' | 'put' | 'delete'): any {
    return this.rest[prop].bind(this.rest, this.endpoint);
  }
}
