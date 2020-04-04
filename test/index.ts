import Redis = require('ioredis');
import { inspect } from 'util';
import Rest, { RedisMutex } from '../src';

const redis = new Redis();
const r = new Rest('NjE4OTg3OTAzMjg0MDE5MjQx.XoeW5g.licDY7CcMLCPm3_5sYXQNqBIpLQ', {
	mutex: new RedisMutex(redis),
});

r.on('retry', console.log);
r.on('response', (...args) => console.log(new Date(), inspect(args, { depth: 1 })));

(async () => {
	for (let i = 0; i < 31; i++) {
		await r.get('/users/618570414855028767');
		// console.log('done');
	}
})();
