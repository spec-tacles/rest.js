import { Rest, RedisMutex, Events, Retry } from '../src';
import AbortController from 'abort-controller';
// import Redis = require('ioredis');
import { Request, Response } from 'node-fetch';
import { Ratelimit } from '../src/mutexes/RatelimitMutex';

const ctrl = new AbortController();
// const rd = new Redis(process.env.REDIS_URI!);
const r = new Rest(process.env.DISCORD_TOKEN!, {
  // mutex: new RedisMutex(rd, 'discord_bot'),
});
const ids = new Map<Request, string>();
let i = 0;
const pid = process.pid.toString().padStart(5);

r.on(Events.RETRY, (ret: Retry) => {
  console.log('rtl', ids.get(ret.request), pid, new Date(), ret.delay, ret.ratelimit);
});
r.on(Events.REQUEST, (req: Request) => {
  const id = (++i).toString().padStart(2);
  ids.set(req, id);
  console.log('req', id, pid, new Date());
});
r.on(Events.RESPONSE, (req: Request, res: Response, ratelimit: Ratelimit) => {
  console.log('res', ids.get(req), pid, new Date(), ratelimit);
});

(async () => {
  // await rd.flushall();

  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(r.get(process.env.TESTING_URL!, {/*
      content: 'meme'
    }, {
      files: {
        name: 'meme.txt',
        file: Buffer.from('meme'),
      },*/
      signal: ctrl.signal,
    }));
  }

  try {
    await Promise.all(promises);
  } catch (e) {
    console.error(e);
    ctrl.abort();
  } finally {
    // rd.disconnect();
  }
})();
