import * as https from 'https';
import { EventEmitter } from 'events';
import { Headers, HeadersInit, RequestInit } from 'node-fetch';
import { Readable } from 'stream';
import LocalMutex from '../mutexes/Local';
import RatelimitMutex from '../mutexes/RatelimitMutex';
import Request from '../types/Request';
import Bucket from './Bucket';
import * as FormData from 'form-data';
import * as pkg from '../../package.json';

export enum TokenType {
	BOT = 'Bot',
	BEARER = 'Bearer',
	BASIC = 'Basic',
}

export interface Options {
	token?: string;
	tokenType: TokenType,
	base: string,
	version: number,
	agent: https.Agent,
	ua: string,
	mutex: RatelimitMutex,
	retryLimit: number,
}

export default class Rest extends EventEmitter {
	public static setHeaders(req: RequestInit, headers: HeadersInit) {
		if (Array.isArray(headers)) for (const [header, value] of headers) Rest.setHeader(req, header, value);
		else if (headers instanceof Headers) for (const [header, value] of { [Symbol.iterator]: headers.entries }) Rest.setHeader(req, header, value);
		else for (const [header, value] of Object.entries(headers)) Rest.setHeader(req, header, value);
	}

	public static setHeader(req: RequestInit, header: string, value: string) {
		if (Array.isArray(req.headers)) req.headers.push([header, value]);
		else if (req.headers instanceof Headers) req.headers.set(header, value);
		else if (req.headers) req.headers[header] = value;
		else req.headers = new Headers({ [header]: value });
	}

	public static hasHeader(req: RequestInit, header: string) {
		if (Array.isArray(req.headers)) return req.headers.some(([name]) => name === header);
		else if (req.headers instanceof Headers) return req.headers.has(header);
		else if (req.headers) return Object.keys(req.headers).includes(header);

		return false;
	}

	public options: Options;
	public buckets: Map<string, Bucket> = new Map();

	constructor(token: string, options?: Partial<Options>)
	constructor(options?: Partial<Options>)
	constructor(token: string | Partial<Options> = {}, options: Partial<Options> = {}) {
		super();

		if (typeof token === 'string') {
			options.token = token;
		} else {
			options = token;
		}

		this.options = {
			token: options.token,
			tokenType: options.tokenType ?? TokenType.BOT,
			base: options.base ?? 'https://discordapp.com',
			version: options.version ?? 6,
			agent: options.agent ?? new https.Agent({ keepAlive: true }),
			ua: options.ua ?? `DiscordBot (https://github.com/spec-tacles/rest, ${pkg.version})`,
			mutex: options.mutex ?? new LocalMutex(),
			retryLimit: options.retryLimit ?? 5,
		};

		Object.defineProperty(this.options, 'token', { enumerable: false });
	}

	public post(endpoint: string, body: any, options?: Request) {
		return this.make({
			method: 'post',
			endpoint,
			body,
			...options,
		});
	}

	public get(endpoint: string, options?: Request) {
		return this.make({
			method: 'get',
			endpoint,
			...options,
		});
	}

	public put(endpoint: string, body: any, options?: Request) {
		return this.make({
			method: 'put',
			endpoint,
			body,
			...options,
		});
	}

	public delete(endpoint: string, options?: Request) {
		return this.make({
			method: 'delete',
			endpoint,
			...options,
		});
	}

	public patch(endpoint: string, body: any, options?: Request) {
		return this.make({
			method: 'patch',
			endpoint,
			body,
			...options,
		});
	}

	public make(req: Request): Promise<any> {
		// configure route and ratelimiter
		const route = Bucket.makeRoute(req.method ?? 'get', req.endpoint ?? '');
		let b = this.buckets.get(route);
		if (!b) {
			b = new Bucket(this, route);
			this.buckets.set(route, b);
		}

		this.format(req);
		return b.make(req);
	}

	public format(req: Request): void {
		if (
			typeof req.body === 'object' &&
			!(req.body instanceof ArrayBuffer) &&
			!(req.body instanceof Readable)
		) {
			try {
				req.body = JSON.stringify(req.body);
				Rest.setHeader(req, 'Content-Type', 'application/json');
			} catch {}
		} else {
			Rest.setHeader(req, 'Content-Type', 'application/octet-stream');
		}

		if (req.files) {
			const form = new FormData();
			if (Array.isArray(req.files)) for (const f of req.files) form.append(f.name, f.file, f.name);
			else form.append(req.files.name, req.files.file, req.files.name);
			if (typeof req.body !== 'undefined') form.append('payload_json', req.body);
			req.body = form;
			Rest.setHeaders(req, form.getHeaders());
		}

		if (req.reason) Rest.setHeader(req, 'X-Audit-Log-Reason', req.reason);

		if (this.options.token && !Rest.hasHeader(req, 'Authorization')) {
			Rest.setHeader(req, 'Authorization', `${this.options.tokenType} ${this.options.token}`);
		}

		Rest.setHeader(req, 'User-Agent', this.options.ua);

		if (!req.agent) req.agent = this.options.agent;
	}

	public makeURL(endpoint: string): string {
		return `${this.options.base}/api/v${this.options.version}${endpoint}`;
	}
}
