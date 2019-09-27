import { promisify } from 'util';

export const pause = promisify(setTimeout);
