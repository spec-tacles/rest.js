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
	for (let i = 0; i < 31; i++) {
		r.get('/users/618570414855028767');
		// console.log('done');
	}
})();
