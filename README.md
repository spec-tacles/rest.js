# Spectacles REST

A REST router and ratelimiter for the Discord API. Supports local and distributed ratelimit handling; as such, requests are not sent in order.

## Getting started

```js
const { Rest } = require('@spectacles/rest');
const rest = new Rest('token here');
rest.get(`channels/${someID}`).then(console.log);
```

The rest instance has the following methods:

- `get`
- `patch`
- `put`
- `delete`
- `post`

PATCH, PUT, and POST take the request body as the second parameter. All methods take options as the last parameter: options are just an extension of the [Fetch API `init` parameters](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters).

```ts
interface File {
	name: string;
	file: string | Buffer | NodeJS.ReadableStream;
}

interface Request extends RequestInit {
	files?: File | File[];
	reason?: string;
	endpoint?: string;
}
```

For example, you could create a guild ban like so:

```js
rest.put(`/guilds/${guildID}/bans/${userID}`, {}, { reason: 'bad memes' });
```

All REST calls resolve with the JSON parsed response from the Discord API or a Buffer if the Discord API did not send JSON. The library will attempt to retry all ratelimited or 5xx errors up to the `retryLimit` specified in the Rest constructor options.

```ts
enum TokenType {
	BOT = 'Bot',
	BEARER = 'Bearer',
}

interface Options {
	tokenType: TokenType,
	base: string,
	version: number,
	agent: https.Agent,
	ua: string,
	mutex: RatelimitMutex,
	retryLimit: number,
}
```

## Distributed ratelimiting

By default, the library uses a built-in local ratelimiter. To use the built-in Redis ratelimiter:

```js
const { RedisMutex, Rest } = require('@spectacles/rest');
const Redis = require('ioredis');

const redis = new Redis();
const rest = new Rest('token', {
	mutex: new RedisMutex(redis, 'optional key prefix'),
});

// use rest normally
```

You can use anything as a mutex that fulfills the `RatelimitMutex` interface.
