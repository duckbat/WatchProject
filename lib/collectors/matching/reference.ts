import type { Model } from '../../market';

export const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Use the base reference for discovery only; its suffix identifies dial/bracelet variants.
export function baseReference(reference: string) {
  const ref = reference.trim();
  const m = ref.match(/^(.{4,}?)-\d{3,4}$/);
  return m ? m[1] : ref;
}

export function titleTokens(title: string) {
  const out = new Set<string>();
  for (const t of title.toLowerCase().match(/[a-z0-9]+(?:[.\-/][a-z0-9]+)*/g) || []) {
    out.add(compact(t));
    const noRef = t.replace(/^ref(?:erence)?\.?/, '');
    out.add(compact(noRef));
  }
  return out;
}

/** Search terms: brand + base reference, then brand + model line ("Rolex Datejust 36", "Tudor Black Bay Fifty-Eight"). */
export function searchQueries(model: Pick<Model, 'brand' | 'reference' | 'name'> & { family?: string }) {
  const words = (model.name || '').split(/[\s/]+/).filter(Boolean);
  const line =
    words[0] && /^\d{2}(mm)?$/i.test(words[1] || '') ? `${words[0]} ${words[1]}` : model.family || words[0] || '';
  return [`${model.brand} ${baseReference(model.reference)}`, line ? `${model.brand} ${line}` : ''].filter(Boolean);
}
