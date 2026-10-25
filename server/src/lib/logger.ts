import { env } from '../config/env';

/** Console logging, silenced under Jest so expected failures (AI down, bad JSON) don't clutter test output. */
const silent = env.NODE_ENV === 'test';
const noop = () => undefined;

export const logger = {
  info: silent ? noop : console.log.bind(console),
  warn: silent ? noop : console.warn.bind(console),
  error: silent ? noop : console.error.bind(console),
};
