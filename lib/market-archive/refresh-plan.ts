import { allModels, type CatalogModel } from '../catalog';
import { baseReference } from '../collectors/matching/reference';

/**
 * The most traded current and recent Rolex references (base references, all dials). They are collected on a schedule
 * even if nobody opened them, and they are the only watches whose background refresh uses eBay calls.
 */
export const POPULAR_ROLEX = [
  '124060', '126610ln', '126610lv', '126613lb', '126613ln', '126618ln', '114060', '116610ln', '116610lv',
  '126710blnr', '126710blro', '126710grnr', '126720vtnr', '126711chnr', '116710ln',
  '126500ln', '116500ln', '126515ln', '126505', '116508',
  '126200', '126234', '126300', '126334', '126331',
  '124270', '224270', '214270', '226570',
  '124300', '126000', '277200', '134300',
  '126600', '136660', '126622', '226659',
  '126900', '116900', '116400gv', '336934', '326934', '228235', '228238', '128238',
];

/** A popular watch is refreshed when its archive is older than this; other viewed watches likewise. */
export const REFRESH_AFTER_MS = 6 * 3_600_000;

export type ArchiveAge = { modelId: string; fetchedAt: string };
export type RefreshJob = { model: CatalogModel; ebay: boolean; reason: 'popular' | 'viewed' };

let rolexByBase: Map<string, CatalogModel[]> | null = null;

/**
 * One catalog model per popular reference: the dial someone already viewed (its archive keeps growing), otherwise the
 * first dial. Collection searches the base reference, so any dial's archive holds the reference's listings.
 */
export function popularRolexModels(archived: Set<string>): CatalogModel[] {
  rolexByBase ??= allModels.reduce((m, x) => {
    if (x.brand !== 'Rolex') return m;
    const base = baseReference(x.reference).toLowerCase();
    m.set(base, [...(m.get(base) || []), x]);
    return m;
  }, new Map<string, CatalogModel[]>());
  return POPULAR_ROLEX.flatMap((base) => {
    const dials = [...(rolexByBase!.get(base) || [])].sort((a, b) => a.reference.localeCompare(b.reference));
    const pick = dials.find((d) => archived.has(d.id)) || dials[0];
    return pick ? [pick] : [];
  });
}

/**
 * Which watches one scheduled run refreshes, most overdue first: popular Rolexes (with eBay) before other previously
 * viewed catalog watches (without eBay). Never-collected popular watches count as most overdue.
 */
export function planRefresh(
  archives: ArchiveAge[],
  find: (id: string) => CatalogModel | undefined,
  limit: number,
  now = Date.now(),
  failures: ArchiveAge[] = [],
): { jobs: RefreshJob[]; due: number } {
  const fetched = new Map(archives.map((a) => [a.modelId, +new Date(a.fetchedAt) || 0]));
  // A watch whose refresh failed waits like a refreshed one, so a persistent failure cannot take every run (and eBay call).
  for (const f of failures) fetched.set(f.modelId, Math.max(fetched.get(f.modelId) ?? 0, +new Date(f.fetchedAt) || 0));
  const age = (id: string) => (fetched.has(id) ? now - fetched.get(id)! : Infinity);
  const popular = popularRolexModels(new Set(archives.map((a) => a.modelId)));
  const popularIds = new Set(popular.map((m) => m.id));
  const byAge = (a: RefreshJob, b: RefreshJob) => age(b.model.id) - age(a.model.id);
  const popularJobs = popular.filter((m) => age(m.id) >= REFRESH_AFTER_MS).map((model): RefreshJob => ({ model, ebay: true, reason: 'popular' })).sort(byAge);
  const viewedJobs = archives
    .filter((a) => !popularIds.has(a.modelId) && age(a.modelId) >= REFRESH_AFTER_MS)
    .flatMap((a): RefreshJob[] => {
      const model = find(a.modelId);
      return model ? [{ model, ebay: false, reason: 'viewed' }] : [];
    })
    .sort(byAge);
  const all = [...popularJobs, ...viewedJobs];
  return { jobs: all.slice(0, Math.max(0, limit)), due: all.length };
}
