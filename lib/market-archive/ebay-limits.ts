/**
 * eBay's free tier allows about 5,000 Browse calls a day. The calls are counted per UTC day in D1, so every isolate
 * and the scheduled refresh share one count. Background refreshes may use only their share, which is spent on the
 * most popular Rolexes (scheduled-refresh.ts); the rest stays for watch pages people open.
 */
export const EBAY_DAILY_CALLS = 4_800;
export const EBAY_BACKGROUND_CALLS = 3_000;
/** Calls one watch refresh can make: 3 tokens, 4 listing sites, 6 new-offer sites, 4 sold sites once approved. */
export const EBAY_CALLS_PER_REFRESH = 17;

export type EbayDay = { date: string; calls: number; background: number };


export type EbayLimits = { daily: number; background: number };

/** EBAY_DAILY_CALLS / EBAY_BACKGROUND_CALLS environment values override the defaults (e.g. after eBay raises the limit). */
export function ebayLimits(env: { EBAY_DAILY_CALLS?: string; EBAY_BACKGROUND_CALLS?: string }): EbayLimits {
  const n = (v: string | undefined, fallback: number) => (Number(v) > 0 ? Math.floor(Number(v)) : fallback);
  const daily = n(env.EBAY_DAILY_CALLS, EBAY_DAILY_CALLS);
  return { daily, background: Math.min(daily, n(env.EBAY_BACKGROUND_CALLS, EBAY_BACKGROUND_CALLS)) };
}

/** Whether one more refresh fits in today's budget; null when it does, otherwise the reason shown on the eBay chips. */
export function ebayBlocked(day: EbayDay, limits: EbayLimits, background: boolean): string | null {
  if (day.calls + EBAY_CALLS_PER_REFRESH > limits.daily) return 'Not checked in this update: today\'s eBay API calls are used up. Listings from the last check are shown.';
  if (background && day.background + EBAY_CALLS_PER_REFRESH > limits.background) return 'Not checked in this background update: today\'s background eBay calls are used up. Listings from the last check are shown.';
  return null;
}
