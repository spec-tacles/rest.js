# Spectacles REST

A REST router for the Discord API. Built upon Axios: any of the request methods accept parameters according to the [Axios documentation](https://github.com/axios/axios#instance-methods) excluding the URL (automatically handled using the built-in router).

## Getting started

```js
const rest = require('@spectacles/rest')('token here');
rest.channels['some id'].fetch().then(console.log);
```

Any properties called on the rest instance will start a new query. Any additional properties will add to the endpoint. Finally, the request is finalized with one of the following methods:

- `fetch`: GET
- `edit`: PATCH
- `update`: PUT
- `delete`: DELETE
- `create`: POST

For example, you could create a guild ban like so:

```js
rest.guilds['guild ID'].bans['user ID'].update({}, { reason: 'bad memes' });
```
