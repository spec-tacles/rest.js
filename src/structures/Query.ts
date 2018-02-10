import { reflectors } from '../util';
import { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * @typedef ChainableQuery
 * @type {Query|{[key: string]: Query}}
 */
export type ChainableQuery = Query & { [key: string]: Query };

/**
 * An interface for making REST requests to the Discord API.
 */
export default class Query<T = any> {
  public rest: AxiosInstance;

  /**
   * The routing keys of this query. For example, ['guilds', 'id'] translates to `/guilds/id`.
   * @type {string[]}
   * @readonly
   */
  public readonly keys: string[];

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
  constructor(rest: AxiosInstance, start: string) {
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

  /**
   * Freeze this query.
   * @returns {true}
   */
  public freeze() {
    return this.frozen = true;
  }

  /**
   * Make a POST request to the {@link Query#endpoint}.
   * @param {*} data The data with which to create
   * @param {?AxiosRequestConfig} options Options to send with the request
   */
  public create(data: any, options?: AxiosRequestConfig): Promise<T> {
    return this.rest.post<T>(this.endpoint, data, options);
  }

  /**
   * Make a GET request to the {@link Query#endpoint}.
   * @param {?AxiosRequestConfig} options Options to send with the request
   */
  public fetch(options?: AxiosRequestConfig): Promise<T> {
    return this.rest.get<T>(this.endpoint, options);
  }

  /**
   * Make a PUT request to the {@link Query#endpoint}.
   * @param {*} data The data with which to create
   * @param {?AxiosRequestConfig} options Options to send with the request
   */
  public update(data: any, options?: AxiosRequestConfig): Promise<T> {
    return this.rest.put<T>(this.endpoint, data, options);
  }

  /**
   * Make a PATCH request to the {@link Query#endpoint}.
   * @param {*} data The data with which to create
   * @param {?AxiosRequestConfig} options Options to send with the request
   */
  public edit(data: any, options?: AxiosRequestConfig) {
    return this.rest.patch<T>(this.endpoint, data, options);
  }

  /**
   * Make a DELETE request to the {@link Query#endpoint}.
   * @param {?AxiosRequestConfig} options Options to send with the request
   */
  public delete(options?: AxiosRequestConfig): Promise<T> {
    return this.rest.delete(this.endpoint, options);
  }
}
