import { decodeEntities } from '../../core/text';
import type { Model } from '../../../market';
import type { LiveListing } from '../../core/listing';

export const headers = { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)', Accept: 'text/html' };

export const plain = (s: string) =>
  decodeEntities(s.replace(/<br\s*\/?\s*>/gi, '; ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

export const multipleWatches =
  /\b(?:set|collection|group|lot) of (?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b|\bpair of (?:\w+\s+){0,3}watches\b/i;

export const dateOf = (s: string, now: Date) => {
  const date = new Date(s);
  return Number.isFinite(+date) && date.getUTCFullYear() >= 1900 && +date <= +now
    ? date.toISOString().slice(0, 10)
    : null;
};

/** One auction house run: published results, a note for the source chip, and how many catalogue pages failed. */
export type AuctionRun = { listings: LiveListing[]; message: string; failed?: number };

export type AuctionHouse = {
  id: string;
  name: string;
  searchUrl: (model: Model & { family?: string }) => string;
  run: (model: Model & { family?: string }, fetcher: typeof fetch, now: Date) => Promise<AuctionRun>;
};
