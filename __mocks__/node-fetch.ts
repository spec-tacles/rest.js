const fetch = jest.requireActual('node-fetch');

export const Request = fetch.Request;
export const Response = fetch.Response;
export const Headers = fetch.Headers;
export default jest.fn(fetch);
