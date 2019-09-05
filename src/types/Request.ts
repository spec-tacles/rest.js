import { RequestInit } from 'node-fetch';

export interface File {
  name: string;
  file: string | Buffer | NodeJS.ReadableStream | Blob;
}

export default interface Request extends RequestInit {
	files?: File | File[];
	reason?: string;
	endpoint?: string;
	failures?: number;
}
