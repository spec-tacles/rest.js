import { Rest, RedisMutex, Events } from '../src';
import AbortController from 'abort-controller';
import Redis = require('ioredis');

const ctrl = new AbortController();
const rd = new Redis(process.env.REDIS_URI!);
const r = new Rest(process.env.DISCORD_TOKEN!, {
  // mutex: new RedisMutex(rd),
});

r.on(Events.RETRY, console.log);
r.on(Events.RESPONSE, () => console.log(new Date()));

(async () => {
  await rd.flushall();

  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(r.post(process.env.TESTING_URL!, {
      content: 'meme'
    }, {
      files: {
        name: 'meme.txt',
        file: Buffer.from('meme'),
      },
      signal: ctrl.signal,
    }));
  }

  try {
    await Promise.all(promises);
  } catch (e) {
    console.error(e);
    ctrl.abort();
  } finally {
    rd.disconnect();
  }
})();
