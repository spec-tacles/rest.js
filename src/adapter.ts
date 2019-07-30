import { AxiosRequestConfig, AxiosResponse } from 'axios';
import Bucket from './structures/Bucket';

export const buckets: Map<string, Bucket> = new Map();

/**
 * Make an Axios adapter that automatically handles ratelimits.
 * @param {Client} client The client for which to make this adapter
 * @returns {AxiosAdapter}
 */
export default async function adapt(config: AxiosRequestConfig): Promise<AxiosResponse> {
  // configure route and ratelimiter
  const bucket = config.headers['x-ratelimit-bucket'];
  let b = buckets.get(bucket);
  if (!b) {
    b = new Bucket();
    buckets.set(bucket, b);
  }

  // make request
  return b.enqueue(config);
}
