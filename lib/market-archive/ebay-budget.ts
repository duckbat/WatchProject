import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import { records } from '../../db/schema';
import { type EbayDay } from './ebay-limits';

export * from './ebay-limits';

const owner = '__market__';
const idFor = (date: string) => `ebay-usage:${date}`;
const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

export async function ebayDay(now = new Date()): Promise<EbayDay> {
  const date = utcDay(now);
  const row = await getDb().select().from(records).where(eq(records.id, idFor(date))).get();
  const data = row ? (JSON.parse(row.payload) as Partial<EbayDay>) : {};
  return { date, calls: Number(data.calls) || 0, background: Number(data.background) || 0 };
}

/** Adds a refresh's calls to today's count in one statement, so concurrent refreshes cannot lose each other's calls. */
export async function addEbayCalls(calls: number, background: boolean, now = new Date()) {
  if (calls <= 0) return;
  const date = utcDay(now), bg = background ? calls : 0;
  await getDb()
    .insert(records)
    .values({ id: idFor(date), owner, kind: 'ebay-usage', payload: JSON.stringify({ date, calls, background: bg }) })
    .onConflictDoUpdate({
      target: records.id,
      set: {
        payload: sql`json_set(${records.payload}, '$.calls', coalesce(json_extract(${records.payload}, '$.calls'), 0) + ${calls}, '$.background', coalesce(json_extract(${records.payload}, '$.background'), 0) + ${bg})`,
      },
    });
}
