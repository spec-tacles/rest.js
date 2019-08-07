import { RequestInit } from 'node-fetch';
import Rest from '../Rest';

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
  public rest: Rest;

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

  /**
   * @constructor
   * @param {Client} client The client to make this query with.
   * @param {string} start The base of the endpoint of this query.
   */
  constructor(rest: Rest, start: string) {
    this.rest = rest;
    this.keys = [start];
  }

  /**
   * The endpoint to make this request to.
   * @returns {string}
   */
  public get endpoint() {
    return `/${this.keys.join('/')}`;
  }

  public post<T = any>(data: any, options?: RequestInit) {
    return this.rest.post<T>(this.endpoint, data, options);
  }

  public get<T = any>(options?: RequestInit) {
    return this.rest.get<T>(this.endpoint, options);
  }

  public put<T = any>(data: any, options?: RequestInit) {
    return this.rest.put<T>(this.endpoint, data, options);
  }

  public delete<T = any>(options?: RequestInit) {
    return this.rest.delete<T>(this.endpoint, options);
  }

  public patch<T = any>(data: any, options?: RequestInit) {
    return this.rest.patch<T>(this.endpoint, data, options);
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
