const { rest, RedisStore } = require('../dist');
const Redis = require('ioredis');
const rd = new Redis('localhost');
const r = rest(process.env.DISCORD_TOKEN, {
  store: new RedisStore(rd),
});
// console.log(process.env.DISCORD_TOKEN);

// r.asd.fetch().then(r => console.log(r));
(async () => {
  for (let i = 0; i < 20; i++) {
    const message = r.channels['411451531238572032'].messages.post({
      content: 'meme'
    }, {
      files: {
        name: 'meme.txt',
        file: Buffer.from('meme'),
      }
    })
    .then(r => console.log(new Date()), console.error);
    // console.log(new Date());
    // console.log(await r.post('/notexsts', { content: 'meme' }).catch(r => r));
    // await r.channels['411451531238572032'].messages[message.id].edit({ content: 'meme2' });
  }
})();
