const { rest, RedisStore } = require('../dist');
const Redis = require('ioredis');
const rd = new Redis('localhost');
const r = rest(process.env.DISCORD_TOKEN, {
  // mutex: new RedisStore(rd),
});
// console.log(process.env.DISCORD_TOKEN);

// r.asd.fetch().then(r => console.log(r));
(async () => {
  await rd.flushall();

  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(r.channels['411451531238572032'].messages.post({
      content: 'meme'
    }, {
      files: {
        name: 'meme.txt',
        file: Buffer.from('meme'),
      }
    })
    .then(r => console.log(new Date()), console.error));
  }

  await Promise.all(promises);
  rd.disconnect();
})();
