const rest = require('../dist');
const r = rest(process.env.DISCORD_TOKEN);
// console.log(process.env.DISCORD_TOKEN);

r.asd.fetch().then(r => console.log(r));
// for (let i = 0; i < 75; i++) r.get('/guilds/281630801660215296').then((res) => console.log(Date.now(), res.status));
