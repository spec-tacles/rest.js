export const __start = Date.now();
export const __now = jest.spyOn(Date, 'now')
	.mockReturnValue(__start);

export const pause = jest.fn((timeout: number) => {
	__now.mockReturnValue(Date.now() + timeout);
	return Promise.resolve();
});
