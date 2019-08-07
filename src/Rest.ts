import https = require('https');
import fetch, { RequestInit, Headers, HeadersInit, Response } from 'node-fetch';
import FormData = require('form-data');
import RatelimitMutex from './stores/RatelimitMutex';
import LocalMutex from './stores/Local';
import Request from './Request';
import Bucket from './structures/Bucket';

export enum TokenType {
	BOT = 'Bot',
	BEARER = 'Bearer',
}

export interface Options {
	tokenType: TokenType,
	base: string,
	version: number,
	agent: https.Agent,
	ua: string,
	mutex: RatelimitMutex,
}

export default class Rest {
	public static setHeaders(req: RequestInit, headers: HeadersInit) {
		if (Array.isArray(headers)) for (const [header, value] of headers) Rest.setHeader(req, header, value);
		else if (headers instanceof Headers) for (const [header, value] of { [Symbol.iterator]: () => headers.entries() }) Rest.setHeader(req, header, value);
		else for (const [header, value] of Object.entries(headers)) Rest.setHeader(req, header, value);
	}

	public static setHeader(req: RequestInit, header: string, value: string) {
		if (Array.isArray(req.headers)) req.headers.push([header, value]);
		else if (req.headers instanceof Headers) req.headers.set(header, value);
		else if (req.headers) req.headers[header] = value;
		else req.headers = { [header]: value };
	}

	public options: Options;
	public buckets: Map<string, Bucket> = new Map();

	constructor(public token: string, options: Partial<Options> = {}) {
		this.options = {
			tokenType: options.tokenType || TokenType.BOT,
			base: options.base || 'https://discordapp.com',
			version: options.version || 6,
			agent: options.agent || new https.Agent({ keepAlive: true }),
			ua: options.ua || `DiscordBot (https://github.com/spec-tacles/rest, ${require('../package.json').version})`,
			mutex: options.mutex || new LocalMutex(),
		};

		Object.defineProperty(this, 'token', { enumerable: false });
	}

	public post<T = any>(endpoint: string, body: any, options?: RequestInit) {
		return this.enqueue<T>({
			method: 'post',
			endpoint,
			body,
			...options,
		});
	}

	public get<T = any>(endpoint: string, options?: RequestInit) {
		return this.enqueue<T>({
			method: 'get',
			endpoint,
			...options,
		});
	}

	public put<T = any>(endpoint: string, body: any, options?: RequestInit) {
		return this.enqueue<T>({
			method: 'put',
			endpoint,
			body,
			...options,
		});
	}

	public delete<T = any>(endpoint: string, options?: RequestInit) {
		return this.enqueue<T>({
			method: 'delete',
			endpoint,
			...options,
		});
	}

	public patch<T = any>(endpoint: string, body: any, options?: RequestInit) {
		return this.enqueue<T>({
			method: 'patch',
			endpoint,
			body,
			...options,
		});
	}

	public enqueue<T>(req: Request): Promise<T | Buffer> {
		// configure route and ratelimiter
		const route = Bucket.makeRoute(req.method || 'get', req.endpoint || '');
		let b = this.buckets.get(route);
		if (!b) {
			b = new Bucket(this, route);
			this.buckets.set(route, b);
		}

		// make request
		return b.enqueue<T>(req);
	}

	public do(req: Request): Promise<Response> {
		if (req.files) {
			const form = new FormData();
			if (!Array.isArray(req.files)) req.files = [req.files];
			for (const f of req.files) form.append(f.name, f.file, f.name);
			if (typeof req.body !== undefined) form.append('payload_json', JSON.stringify(req.body));
			req.body = form;
			Rest.setHeaders(req, form.getHeaders());
		}

		if (req.reason) Rest.setHeader(req, 'X-Audit-Log-Reason', req.reason);
		Rest.setHeaders(req, {
			Authorization: `${this.options.tokenType} ${this.token}`,
			'User-Agent': this.options.ua,
		});

		return fetch(this.makeURL(req.endpoint), {
			method: req.method,
			body: req.body,
			headers: req.headers,
			agent: req.agent || this.options.agent,
			redirect: req.redirect,
			follow: req.follow,
			timeout: req.timeout,
			compress: req.compress,
			size: req.size,
		});
	}

	public makeURL(endpoint: string): string {
		return `${this.options.base}/api/v${this.options.version}${endpoint}`;
	}
}
