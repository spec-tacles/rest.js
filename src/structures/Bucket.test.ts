import fetch, { Response, Headers } from 'node-fetch';
import Bucket from './Bucket';
import Rest from './Rest';
import Events from '../types/Events';
import { Request } from '..';

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
	const res = new Response('{"foo":"bar"}', {
		headers: {
			'Content-Type': 'application/json',
			'X-Ratelimit-Limit': '5',
			'X-Ratelimit-Reset-After': '2.5',
		},
	});
	mockedFetch.mockResolvedValue(res);

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
