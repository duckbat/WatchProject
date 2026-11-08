import { catalogRows } from './catalog-shards';
import { expectedDial } from './collectors/matching/dial';
import { baseReference } from './collectors/matching/reference';
import { catalog as starter, type Model } from './market';

export type CatalogModel = Model & { family?: string; sourceUrl?: string };

const rows = catalogRows as CatalogModel[];
const seen = new Set(rows.map((r) => r.id));
// Preserve IDs already referenced by collection and observation records.
export const allModels: CatalogModel[] = [...rows, ...starter.filter((m) => !seen.has(m.id))];
const byId = new Map(allModels.map((m) => [m.id, m]));
export const findCatalogModel = (id: string) => byId.get(id);

export const brands = [...new Set(allModels.map((m) => m.brand))].sort((a, b) => a.localeCompare(b));
const counts = new Map<string, number>();
for (const m of allModels) counts.set(m.brand, (counts.get(m.brand) || 0) + 1);
export const brandCounts = brands.map((brand) => ({ brand, count: counts.get(brand) || 0 }));

const haystack = new Map(allModels.map((m) => [m.id, `${m.brand} ${m.name} ${m.reference} ${m.family || ''}`.toLocaleLowerCase()]));
const squash = (s: string) => s.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');

// ---- Variants: one watch, several dials/bracelets (126200-0001 … 126200-0030 share base reference 126200) ----

const groupKey = (m: Model) => `${m.brand}|${squash(baseReference(m.reference))}`;
const groups = new Map<string, CatalogModel[]>();
for (const m of allModels) groups.set(groupKey(m), [...(groups.get(groupKey(m)) || []), m]);
// Starter entries (rolex-124060) duplicate full catalog rows; they stay findable by ID but are not listed as variants.
const isStarter = (m: Model) => !m.id.startsWith('ref-');

/** Every dial/bracelet variant of this watch's base reference, including itself. */
export function variantsOf(model: Model): CatalogModel[] {
  const members = groups.get(groupKey(model)) || [model];
  const real = members.filter((m) => !isStarter(m));
  return real.length ? real : members;
}

/** What tells this variant apart from its siblings: "Blue · Oyster" out of "Datejust 36 Stainless Steel / Domed / Blue / Oyster". */
export function variantLabel(model: CatalogModel, siblings: Model[]) {
  // Newer catalog names put the bezel in the case segment; normalize it before finding shared parts.
  const parts = (m: Model) => m.name.split('/').flatMap((s, i) => (i === 0 ? s.replace(/\s+-\s+(Fluted|Domed|Smooth)\s*$/i, ' / $1') : s).split('/')).map((s) => s.trim()).filter(Boolean);
  const shared = siblings.length > 1 ? parts(siblings[0]).filter((p) => siblings.every((s) => parts(s).includes(p))) : [];
  let own = parts(model).filter((p) => !shared.includes(p));
  // The leading "Datejust 36 Stainless Steel" names the model, not the variant.
  const line = (model.family || model.name.split(/\s+/)[0]).toLocaleLowerCase();
  if (own.length > 1 && own[0].toLocaleLowerCase().startsWith(line)) own = own.slice(1);
  return own.map((p) => p.replace(/\bpalm\b(?![ -]+motif)/gi, 'Palm motif').replace(/\s+-\s+fluted\b/i, ' fluted motif').replace(/\bMOP\b/gi, 'Mother of pearl')).join(' · ') || model.reference;
}

/** The dial color named in the catalog name, when there is exactly one. */
export function dialOf(model: Model): string | null {
  const colors = [...expectedDial(model.name)];
  return colors.length === 1 ? colors[0] : null;
}

// ---- Search ----

/** Market data adds at most 19, so it orders watches within a tier but never lifts one over a closer reference match. */
const dataBoost = (priced = 0) => Math.min(19, 4 * Math.log2(1 + priced));

/** Higher is better: exact reference, then reference prefix, brand+model line, then plain token match. */
function rank(m: CatalogModel, q: string, tokens: string[], priced = 0) {
  const ref = squash(m.reference), sq = squash(q);
  let score = 0;
  if (sq && ref === sq) score += 100;
  else if (sq && ref.startsWith(sq)) score += 60;
  else if (tokens.some((t) => squash(t).length >= 3 && ref.startsWith(squash(t)))) score += 40;
  const name = `${m.brand} ${m.name}`.toLocaleLowerCase();
  if (name.startsWith(q)) score += 30;
  if (m.brand.toLocaleLowerCase() === tokens[0]) score += 10;
  if (m.imageUrl) score += 2;
  return score + dataBoost(priced);
}

export type SearchItem = CatalogModel & { priced?: number; variants?: number };

/**
 * Results are ordered by market data: the watches with the most priced observations first, then fewer, then none
 * (text relevance breaks ties). An exact reference match always stays on top. `popularity`: priced observations per
 * model ID. `group` (default): one result per base reference, shown with its best-matching dial and the dial count.
 */
export function searchCatalog({
  q = '',
  brand = '',
  page = 1,
  pageSize = 24,
  popularity = new Map<string, number>(),
  group = true,
}: { q?: string; brand?: string; page?: number; pageSize?: number; popularity?: Map<string, number>; group?: boolean }) {
  const query = q.trim().toLocaleLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  const priced = (m: CatalogModel) => popularity.get(m.id) || 0;
  let matching = allModels.filter((m) => (!brand || m.brand === brand) && tokens.every((t) => haystack.get(m.id)!.includes(t)));
  if (tokens.length)
    matching = matching
      .map((m) => ({ m, s: rank(m, query, tokens, priced(m)) }))
      .sort((a, b) => b.s - a.s || priced(b.m) - priced(a.m))
      .map((x) => x.m);
  else if (popularity.size) matching = [...matching].sort((a, b) => priced(b) - priced(a)); // stable: catalog order otherwise

  let items: SearchItem[] = matching;
  if (group) {
    // The best-ranked matching variant represents its watch; a starter duplicate yields to a full catalog row.
    const picked = new Map<string, CatalogModel>();
    for (const m of matching) {
      const k = groupKey(m), current = picked.get(k);
      if (!current || (isStarter(current) && !isStarter(m))) picked.set(k, m);
    }
    items = [...picked.values()].map((m) => {
      const variants = variantsOf(m);
      const best = Math.max(0, ...variants.map(priced), priced(m));
      return { ...m, variants: variants.length, ...(best ? { priced: best } : {}) };
    });
  } else items = items.map((m) => (popularity.has(m.id) ? { ...m, priced: priced(m) } : m));
  // Stable sort: equal data keeps the relevance order from above.
  const sq = squash(query);
  const exact = (m: SearchItem) => (sq && variantsOf(m).some((v) => squash(v.reference) === sq || squash(baseReference(v.reference)) === sq) ? 1 : 0);
  if (popularity.size) items = [...items].sort((a, b) => exact(b) - exact(a) || (b.priced || 0) - (a.priced || 0));

  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    total: items.length,
    totalCatalog: allModels.length,
    page: current,
    pages,
    pageSize,
    brands,
    source: 'Timepiecepedia · CC0 catalog metadata',
    coverage: 'Catalog coverage is incomplete; prices require separate market observations.',
  };
}

/** Watches with the most priced market observations, one per base reference, shown with their best-covered dial. */
export function mostTracked(popularity: Map<string, number>, limit = 12): SearchItem[] {
  const best = new Map<string, SearchItem>();
  for (const [id, priced] of popularity) {
    const m = byId.get(id);
    if (!m) continue;
    const k = groupKey(m), current = best.get(k);
    const better = !current || priced > current.priced! || (priced === current.priced && Boolean(m.imageUrl) && !current.imageUrl);
    if (better) best.set(k, { ...m, priced, variants: variantsOf(m).length });
  }
  return [...best.values()].sort((a, b) => b.priced! - a.priced!).slice(0, limit);
}

// ---- Reference index for matching free text (forum posts) to catalog entries; variant suffixes (-0001) are optional ----

const refIndex = new Map<string, CatalogModel[]>();
for (const m of allModels) {
  for (const k of new Set([squash(m.reference), squash(m.reference.replace(/-\d{3,4}$/, ''))])) {
    if (k.length < 4) continue;
    const xs = refIndex.get(k) || [];
    if (xs.length < 12) xs.push(m);
    refIndex.set(k, xs);
  }
}

export function matchReferences(text: string) {
  const lower = text.toLocaleLowerCase();
  const tokens = new Set<string>();
  for (const t of lower.match(/[a-z0-9][a-z0-9.\-/]{3,}/g) || []) {
    if (!/\d/.test(t)) continue;
    const k = squash(t.replace(/^ref\.?/, '').replace(/^m(?=\d{5})/, ''));
    tokens.add(squash(t));
    tokens.add(k);
    const market = k.match(/^(.{5,}?)(j1|k1|p1|j|k)$/);
    if (market) tokens.add(market[1]);
  }
  const found: CatalogModel[] = [];
  for (const t of tokens) for (const m of refIndex.get(t) || []) if (!found.includes(m)) found.push(m);
  return found
    .sort((a, b) => Number(lower.includes(b.brand.toLocaleLowerCase())) - Number(lower.includes(a.brand.toLocaleLowerCase())))
    .slice(0, 6);
}
