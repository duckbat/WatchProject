/** "5 days ago" / "14 hours ago" relative to now. */
export function relativeDate(text: string, now = new Date()) {
  const m = text.trim().match(/^(\d+|an?|one)\s+(minute|hour|day|week|month|year)s?\s+ago$/i);
  if (!m) return undefined;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const days = { minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 }[m[2].toLowerCase() as 'day'];
  return new Date(+now - n * days * 86_400_000).toISOString().slice(0, 10);
}
