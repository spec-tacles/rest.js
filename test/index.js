const { default: axios } = require('../dist');
const r = axios(process.env.DISCORD_TOKEN);
// console.log(process.env.DISCORD_TOKEN);

r.get('/asd').then(r => console.log(r));
// for (let i = 0; i < 75; i++) r.get('/guilds/281630801660215296').then((res) => console.log(Date.now(), res.status));
