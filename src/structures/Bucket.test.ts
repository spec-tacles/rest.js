import fetch, { Response, Headers } from 'node-fetch';
import Bucket from './Bucket';
import Rest from './Rest';
import Events from '../types/Events';
import { Request, RetryReason } from '..';

jest.mock('node-fetch');
jest.mock('../mutexes/Local');

const mockedFetch = fetch as any as jest.Mock<Promise<Response>>;

let rest: Rest;
let bucket: Bucket;

beforeEach(() => {
	rest = new Rest('token');
	bucket = new Bucket(rest, 'route');
});

test('creates channel buckets', () => {
	const general = Bucket.makeRoute('get', '/channels/620642587224703017');
	expect(general).toBe('/channels/620642587224703017');

	const messages = Bucket.makeRoute('get', '/channels/620642587224703017/messages');
	expect(messages).toBe('/channels/620642587224703017/messages');

	const first = Bucket.makeRoute('get', '/channels/620642587224703017/messages/627206532337106944');
	expect(first).toBe('/channels/620642587224703017/messages/:id');
});

test('makes single request', async () => {
	const res = new Response(Buffer.from('{"foo":"bar"}'), {
		headers: {
			'Content-Type': 'application/json',
			'X-Ratelimit-Limit': '5',
			'X-Ratelimit-Reset-After': '2.5',
		},
		url: '',
	});
	mockedFetch.mockResolvedValue(res.clone());

	const emitter = jest.spyOn(rest, 'emit');
	const req: Request = {
		endpoint: 'foo',
		body: '',
	};

	const data = await bucket.make(req);

	expect(req.headers).toBeInstanceOf(Headers);
	expect((req.headers as Headers).get('x-ratelimit-precision')).toBe('millisecond');
	expect(data).toStrictEqual({ foo: 'bar' });
	expect(emitter).toBeCalledTimes(2);
	expect(emitter).toHaveBeenNthCalledWith(1, Events.REQUEST, req);
	expect(emitter).toHaveBeenLastCalledWith(Events.RESPONSE, req, res, {
		limit: 5,
		timeout: 2500,
	});
});

test('retries after 429', async () => {
	const res429 = new Response('{"foo":"bar"}', {
		headers: {
			'Content-Type': 'application/json',
			'X-Ratelimit-Limit': '5',
			'X-Ratelimit-Reset-After': '2.5',
			'Retry-After': '2500'
		},
		status: 429,
		url: '',
	});

	const res200 = new Response('{"foo":"bar"}', {
		headers: {
			'Content-Type': 'application/json',
			'X-Ratelimit-Limit': '5',
			'X-Ratelimit-Reset-After': '2.5',
		},
		status: 200,
		url: '',
	});

	let calls = 0;
	mockedFetch.mockImplementation(async () => {
		if (calls++ === 0) return res429.clone();
		return res200.clone();
	});

	const emitter = jest.spyOn(rest, 'emit');
	const req: Request = {
		endpoint: 'foo',
		body: '',
	};

	const data = await bucket.make(req);

	expect(req.headers).toBeInstanceOf(Headers);
	expect((req.headers as Headers).get('x-ratelimit-precision')).toBe('millisecond');
	expect(data).toStrictEqual({ foo: 'bar' });
	expect(emitter).toBeCalledTimes(5);
	expect(emitter).toHaveBeenNthCalledWith(1, Events.REQUEST, req);
	expect(emitter).toHaveBeenNthCalledWith(2, Events.RESPONSE, req, res429, {
		limit: 5,
		timeout: 2500,
	});
	expect(emitter).toHaveBeenNthCalledWith(3, Events.RETRY, {
		reason: RetryReason.RATELIMIT,
		delay: 2500,
		request: req,
		response: res429,
		ratelimit: {
			limit: 5,
			timeout: 2500,
		},
	});
	expect(emitter).toHaveBeenNthCalledWith(4, Events.REQUEST, req);
	expect(emitter).toHaveBeenNthCalledWith(5, Events.RESPONSE, req, res200, {
		limit: 5,
		timeout: 2500,
	});
});
