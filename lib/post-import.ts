// Turns text copied from a Facebook group (or any forum feed) into individual posts with a date and sold flag.

const ACTION_LINE = /^(like|comment|share|send|reply|follow|tykkää|kommentoi|jaa|lähetä|vastaa|seuraa|all reactions:?|kaikki reaktiot:?|\d+\s*(comments?|kommentti(a)?|shares?|jakoa?))$/i;

/** Splits on Facebook's per-post action rows ("Like / Comment / Share") or, failing that, on blank lines. */
export function splitPosts(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const posts: string[] = [];
  let cur: string[] = [];
  let sawActions = false;
  for (const line of lines) {
    if (ACTION_LINE.test(line)) {
      sawActions = true;
      if (cur.join('').trim()) posts.push(cur.join('\n').trim());
      cur = [];
    } else cur.push(line);
  }
  if (cur.join('').trim()) posts.push(cur.join('\n').trim());
  const out = sawActions ? posts : text.split(/\n\s*\n+/).map((p) => p.trim());
  return out.filter((p) => p.length >= 8).slice(0, 300);
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  tammi: 0, helmi: 1, maalis: 2, huhti: 3, touko: 4, kesä: 5, heinä: 6, elo: 7, syys: 8, loka: 9, marras: 10, joulu: 11,
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Reads relative ("3 d", "5 h", "2 wk", "Yesterday", "eilen") or absolute ("October 3", "3. lokakuuta 2025", "3.10.2025") dates. */
export function parsePostDate(text: string, now = new Date()): string | null {
  const head = text.slice(0, 400).toLowerCase();
  const rel = head.match(/(?:^|\s|·)(\d{1,2})\s*(min|m|h|hrs?|hours?|t|tuntia?|d|days?|pv|päivää?|w|wk|weeks?|vk|viikkoa?|y|yr|years?|v)\b(?:\s+ago)?/);
  if (rel) {
    const n = Number(rel[1]), u = rel[2];
    const days = /^(min|m|h|hrs?|hours?|t|tuntia?)$/.test(u) ? 0 : /^(d|days?|pv|päivää?)$/.test(u) ? n : /^(w|wk|weeks?|vk|viikkoa?)$/.test(u) ? n * 7 : n * 365;
    return iso(new Date(now.getTime() - days * 86_400_000));
  }
  if (/\b(yesterday|eilen)\b/.test(head)) return iso(new Date(now.getTime() - 86_400_000));
  const num = head.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/);
  if (num) return iso(new Date(Date.UTC(Number(num[3].length === 2 ? '20' + num[3] : num[3]), Number(num[2]) - 1, Number(num[1]))));
  const en = head.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/) || head.match(/\b(\d{1,2})\.?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(\d{4}))?/);
  const fi = head.match(/\b(\d{1,2})\.\s*(tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuuta(?:\s+(\d{4}))?/);
  const m = fi ? { d: fi[1], mo: fi[2], y: fi[3] } : en ? (/^\d/.test(en[1]) ? { d: en[1], mo: en[2], y: en[3] } : { d: en[2], mo: en[1], y: en[3] }) : null;
  if (m) {
    let d = new Date(Date.UTC(m.y ? Number(m.y) : now.getUTCFullYear(), MONTHS[m.mo], Number(m.d)));
    if (!m.y && d > now) d = new Date(Date.UTC(now.getUTCFullYear() - 1, MONTHS[m.mo], Number(m.d)));
    return iso(d);
  }
  return null;
}

export const isSold = (text: string) => /\b(sold|myyty|myyty pois|varattu|reserved|pending)\b/i.test(text);
export const postLink = (text: string) => text.match(/https:\/\/(?:www\.|m\.)?facebook\.com\/groups\/[\w.]+\/(?:posts|permalink)\/\d+\/?/)?.[0] || null;
