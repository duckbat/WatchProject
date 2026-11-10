// Reads the result cards of an eBay sold-items search, captured by the Save to WatchLedger button in the user's own
// browser (the server never fetches eBay pages). Bundled for the browser: keep imports small.
import { extractPrice } from './collectors/core/price';
import { countries } from './market';

/** One result card: its item link and the card's visible text, as the bookmarklet captured them. */
export type EbayCard = { url: string; text: string };

export type EbaySoldItem = {
  url: string;
  title: string;
  price: number;
  currency: string;
  /** confirmed-sale: price paid (Buy It Now or winning bid). sold-asking: best offer accepted, so only the last ask is known. */
  status: 'confirmed-sale' | 'sold-asking';
  soldAt: string;
  country: string;
  condition: 'new' | 'used' | 'unknown';
};

const MONTHS: Record<string, number> = {
  jan: 1, janv: 1, gen: 1, ene: 1, januar: 1,
  feb: 2, fev: 2, febr: 2,
  mar: 3, mär: 3, maer: 3, mars: 3, marz: 3,
  apr: 4, avr: 4, abr: 4,
  may: 5, mai: 5, mag: 5,
  jun: 6, juin: 6, giu: 6,
  jul: 7, juil: 7, lug: 7,
  aug: 8, aou: 8, aoû: 8, ago: 8,
  sep: 9, sept: 9, set: 9,
  oct: 10, okt: 10, ott: 10,
  nov: 11,
  dec: 12, dez: 12, déc: 12, dic: 12,
};

const SOLD_LINE = /^(?:sold|verkauft|vendu|venduto|vendido)\b[\s:]*(?:le|il|el|am|on)?\s*(.+)$/i;

/** "Nov 5, 2026", "5 Nov 2026", "5. Nov 2026", "5 nov. 2026" → 2026-11-05. */
export function parseSoldDate(s: string): string | null {
  const t = s.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(/^([a-zäéû]+) (\d{1,2}) (\d{4})/) || t.match(/^(\d{1,2}) ([a-zäéû]+) (\d{4})/);
  if (!m) return null;
  const [day, name] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]];
  const month = MONTHS[name] ?? MONTHS[name.slice(0, 4)] ?? MONTHS[name.slice(0, 3)];
  if (!month || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The eBay site's own country: eBay names the seller's country only when it differs ("from United Kingdom"). */
const SITE_COUNTRY: Record<string, string> = { 'ebay.com': 'US', 'ebay.de': 'DE', 'ebay.co.uk': 'GB', 'ebay.fr': 'FR', 'ebay.it': 'IT', 'ebay.es': 'ES', 'ebay.nl': 'NL', 'ebay.at': 'AT', 'ebay.ch': 'CH', 'ebay.ie': 'IE', 'ebay.be': 'BE', 'ebay.pl': 'PL' };
const LOCAL_NAMES: Record<string, string> = { 'vereinigtes königreich': 'GB', 'vereinigte staaten': 'US', 'usa': 'US', deutschland: 'DE', frankreich: 'FR', italien: 'IT', spanien: 'ES', schweiz: 'CH', österreich: 'AT', niederlande: 'NL', schweden: 'SE', finnland: 'FI', dänemark: 'DK', norwegen: 'NO', 'royaume-uni': 'GB', 'états-unis': 'US', allemagne: 'DE', 'regno unito': 'GB', 'stati uniti': 'US', germania: 'DE', 'reino unido': 'GB', 'estados unidos': 'US', alemania: 'DE' };
const byName = new Map(Object.entries(countries).map(([code, name]) => [name.toLowerCase(), code]));

function sellerCountry(lines: string[], site: string) {
  for (const line of lines) {
    const m = line.match(/^(?:from|aus|de|da|desde)\s+(.+)$/i);
    if (!m) continue;
    const name = m[1].trim().toLowerCase();
    return byName.get(name) || LOCAL_NAMES[name] || 'UNKNOWN';
  }
  return SITE_COUNTRY[site.replace(/^www\./, '')] || 'UNKNOWN';
}

const NOISE = /^(?:new listing|neues angebot|nouvelle annonce|nuova inserzione|nuevo anuncio|sponsored|gesponsert|sponsorisé|sponsorizzato|patrocinado|opens in a new window or tab|wird in neuem fenster oder tab geöffnet)$/i;
const SHIPPING = /shipping|postage|delivery|versand|livraison|spedizione|envío|envio|import charges|einfuhr/i;

/**
 * The sold items among an eBay search page's cards. Cards without a "Sold …" date (active or unsold listings) are
 * skipped; a price eBay shows only as a strikethrough after an accepted best offer is kept as the last asking price.
 */
export function parseEbaySoldCards(cards: EbayCard[]): EbaySoldItem[] {
  const out: EbaySoldItem[] = [];
  const seen = new Set<string>();
  for (const card of cards.slice(0, 240)) {
    let url: URL;
    try {
      url = new URL(card.url);
    } catch {
      continue;
    }
    const id = url.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})$/)?.[1];
    if (url.protocol !== 'https:' || !/(^|\.)ebay\.[a-z.]+$/.test(url.hostname) || !id || seen.has(id)) continue;
    const lines = String(card.text || '').slice(0, 1500).split('\n').map((l) => l.trim()).filter(Boolean);
    const soldLine = lines.find((l) => SOLD_LINE.test(l));
    const soldAt = soldLine ? parseSoldDate(soldLine.match(SOLD_LINE)![1]) : null;
    if (!soldAt) continue;
    const title = lines
      .map((l) => l.replace(/^(?:new listing|neues angebot|nouvelle annonce|nuova inserzione|nuevo anuncio)\s*/i, '').replace(/\s*(?:opens in a new window or tab|wird in neuem fenster oder tab geöffnet)$/i, ''))
      .find((l) => l.length > 10 && !NOISE.test(l) && !SOLD_LINE.test(l));
    const priceLine = lines.find((l) => l !== soldLine && l !== title && !SHIPPING.test(l) && extractPrice(l));
    const price = priceLine ? extractPrice(priceLine) : null;
    if (!title || !price) continue;
    const text = lines.join('\n');
    seen.add(id);
    out.push({
      url: `${url.origin}/itm/${id}`,
      title: title.slice(0, 300),
      price: price.price,
      currency: price.currency,
      status: /best offer accepted|preisvorschlag angenommen|offre directe acceptée|offerta accettata|oferta aceptada/i.test(text) ? 'sold-asking' : 'confirmed-sale',
      soldAt,
      country: sellerCountry(lines.filter((l) => l !== title && !l.includes(title)), url.hostname),
      condition: /\b(?:pre-owned|used|gebraucht|occasion|usato|usado)\b/i.test(text) ? 'used' : /\b(?:brand new|new with tags|new without tags|neu|neuf|nuovo|nuevo)\b/i.test(text) ? 'new' : 'unknown',
    });
  }
  return out;
}
