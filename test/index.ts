import Redis = require('ioredis');
import { inspect } from 'util';
import Rest, { RedisMutex } from '../src';

// const redis = new Redis();
const r = new Rest(process.env.DISCORD_TOKEN!, {
	// mutex: new RedisMutex(redis),
});

r.on('retry', console.log);
r.on('response', (...args) => console.log(new Date(), inspect(args, { depth: 1 })));

(async () => {
	for (let i = 0; i < 2; i++) {
		await r.post('/guilds/619013795293167626/channels', { name: 'foo' });
		// console.log('done');
	}
})();
