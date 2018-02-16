const rest = require('../dist');
const r = rest(process.env.DISCORD_TOKEN);
// console.log(process.env.DISCORD_TOKEN);

// r.asd.fetch().then(r => console.log(r));
(async () => {
  // for (let i = 0; i < 20; i++) {
    const message = r.channels['411451531238572032'].messages.create({
      content: 'meme'
    }, {
      files: {
        name: 'meme.txt',
        file: Buffer.from('meme'),
      }
    })
    .catch(() => undefined);
    console.log(new Date());
    // await r.channels['411451531238572032'].messages[message.id].edit({ content: 'meme2' });
  // }
})();
