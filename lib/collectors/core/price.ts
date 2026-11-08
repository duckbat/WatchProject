const currencyBySymbol: Record<string, string> = {
  $: 'USD',
  usd: 'USD',
  '€': 'EUR',
  eur: 'EUR',
  '£': 'GBP',
  gbp: 'GBP',
  chf: 'CHF',
  sek: 'SEK',
  nok: 'NOK',
  dkk: 'DKK',
};

/** First price in the text: "$8,500", "8.500€", "EUR 7900", "£6k"; with a fallback currency also "45 000 kr", "5000:-", "45.000,-". */
export function extractPrice(text: string, fallbackCurrency?: string): { price: number; currency: string } | null {
  const num = '(\\d{1,3}(?:[,.\\u00a0\\u202f ]\\d{3})+|\\d+(?:\\.\\d{1,2})?)';
  const sym = '(\\$|€|£|\\b(?:usd|eur|gbp|chf|sek|nok|dkk)\\b|\\bkr\\.?)';
  // Prefer "$8,500" / "EUR 7900"; then "7.900€" / "7 500 €" / "7500e" / "8500 USD"; then "hinta 7500" / "price: 7500" with a fallback currency.
  const before = text.match(new RegExp(`${sym}\\s?${num}(\\s?k\\b)?`, 'i'));
  const after = before
    ? null
    : text.match(
        new RegExp(
          `${num}(\\s?k\\b)?\\s?(€|£|e\\b|eur\\b|euroa?\\b|usd\\b|gbp\\b|chf\\b|sek\\b|nok\\b|dkk\\b|kr\\b\\.?|:-|,-)`,
          'i',
        ),
      );
  const keyword =
    before || after || !fallbackCurrency
      ? null
      : text.match(
          new RegExp(
            `\\b(?:hinta|hintapyyntö|hp\\.?|h\\.p\\.?|price|asking|pyyntö|myydään|pris|prisidé)\\s*[:=-]?\\s*${num}(\\s?k\\b)?`,
            'i',
          ),
        );
  const m = before
    ? { sym: before[1], raw: before[2], k: before[3] }
    : after
      ? { sym: after[3].trim(), raw: after[1], k: after[2] }
      : keyword
        ? { sym: '', raw: keyword[1], k: keyword[2] }
        : null;
  if (!m) return null;
  const grouped = /[,.\s  ]\d{3}$/.test(m.raw) && !/\.\d{1,2}$/.test(m.raw);
  let price = Number(grouped ? m.raw.replace(/[,.\s  ]/g, '') : m.raw.replace(/,/g, ''));
  if (m.k) price *= 1000;
  const sy = m.sym.toLowerCase();
  const currency =
    sy && !/^(kr\.?|:-|,-)$/.test(sy)
      ? currencyBySymbol[sy] || (/^(e|euro|euroa)$/.test(sy) ? 'EUR' : undefined)
      : fallbackCurrency;
  if (!currency || !Number.isFinite(price) || price < 50 || price > 5_000_000) return null;
  return { price, currency };
}
