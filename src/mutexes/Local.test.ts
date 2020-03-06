import Local from './Local';
import { pause } from '../util';

const mockedPause = pause as unknown as jest.Mock<typeof pause>;

jest.mock('../util');

let mux: Local;

beforeEach(() => {
	mux = new Local();
});

test('setting nothing changes nothing', async () => {
	expect(await mux.set('foo', {})).toBeUndefined();
	expect(mux.global).toBeUndefined();
	expect(await mux.claim('foo')).toBeUndefined();
	expect(mockedPause).toHaveBeenCalledTimes(0);
});

test('setting only timeout does not cause delay', async () => {
	await mux.set('foo', { timeout: 5000 });
	await mux.claim('foo');
	expect(mockedPause).toHaveBeenCalledTimes(0);
});

test('setting only global does not cause delay', async () => {
	await mux.set('foo', { global: true });
	await mux.claim('foo');
	expect(mockedPause).toHaveBeenCalledTimes(0);
});

test('setting only limit does not cause delay', async () => {
	await mux.set('foo', { limit: 5 });
	await mux.claim('foo');
	expect(mockedPause).toHaveBeenCalledTimes(0);
});

test('setting timeout, limit causes delay', async () => {
	await mux.set('foo', { timeout: 5, limit: 1 });
	await mux.claim('foo');
	expect(mockedPause).toHaveBeenCalledTimes(0);

	await mux.claim('foo');

	expect(mockedPause).toHaveBeenCalledTimes(1);
	expect(mockedPause).toHaveBeenCalledWith(5);
});
