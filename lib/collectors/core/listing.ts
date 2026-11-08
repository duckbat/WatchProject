import { z } from 'zod';
import { currencies } from '../../market';

export const collectedPrice = z.object({
  modelId: z.string(),
  sourceId: z.string(),
  country: z.string(),
  currency: z.enum(currencies),
  price: z.number().finite().positive().max(1e9),
  status: z.enum(['asking', 'sold-asking', 'confirmed-sale']),
  observedAt: z.string(),
  condition: z.enum(['used', 'new', 'unknown']),
  sellerType: z.enum(['private', 'dealer', 'unknown']),
  contents: z.literal('unknown'),
  url: z.string().url(),
  title: z.string().max(500),
  collectedAt: z.string(),
});

export type Candidate = z.infer<typeof collectedPrice>;

export type MatchKind = 'exact' | 'reference' | 'similar';

/** listedAt: when the seller posted or last edited the listing (observedAt stays the collection date). */
export type LiveListing = Candidate & { match: MatchKind; image?: string; listedAt?: string; matchDetails?: string };

/** First https image from a string, an array of strings or `{ url }` objects (schema.org and eBay shapes). */
export function firstImage(v: unknown): string | undefined {
  const x: unknown = Array.isArray(v) ? v[0] : v;
  const u = typeof x === 'string' ? x : (x as { url?: unknown } | null | undefined)?.url;
  return typeof u === 'string' && u.startsWith('https://') ? u : undefined;
}
