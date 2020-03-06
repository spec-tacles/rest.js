import Bucket from './Bucket';
import Rest from './Rest';

jest.mock('./Rest');

let rest: Rest;

beforeEach(() => {
	rest = new Rest('token');
});

test('creates channel buckets', () => {
	const general = Bucket.makeRoute('get', '/channels/620642587224703017');
	expect(general).toBe('/channels/620642587224703017');

	const messages = Bucket.makeRoute('get', '/channels/620642587224703017/messages');
	expect(messages).toBe('/channels/620642587224703017/messages');

	const first = Bucket.makeRoute('get', '/channels/620642587224703017/messages/627206532337106944');
	expect(first).toBe('/channels/620642587224703017/messages/:id');
});
