import RedisStore from './stores/Redis';
import { reflectors } from './util';
import Query, { ChainableQuery } from './structures/Query';
import Rest, { Options } from './Rest';

export { RedisStore, Rest, Options, Query, ChainableQuery }
export const rest = (token: string, options: Partial<Options> = {}): ChainableQuery & Rest => {
  const inst = new Rest(token, options);
  return new Proxy(inst as ChainableQuery & Rest, {
    get(target, prop) {
      if (prop in target) return target[prop as any];
      if (reflectors.includes(prop)) return target;

      const q = new Query(inst, prop.toString());
      const p: any = new Proxy(q, {
        get(target, prop) {
          if (reflectors.includes(prop)) return target.endpoint;
          if (prop in target || typeof prop === 'symbol') return (target as any)[prop];
          if (prop != null && !target.frozen) target.keys.push(prop.toString());
          return p;
        },
      });
      return p;
    },
  });
}
