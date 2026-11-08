import type { Model } from '../../market';
import type { MatchKind } from '../core/listing';
import { conflictingDial, titleDialConflict } from './dial';
import { partsListing, wanted } from './keywords';
import { baseReference, compact, titleTokens } from './reference';

function statedReferenceConflict(title: string, model: Pick<Model, 'brand' | 'reference'>) {
  const norm = (r: string) => compact(/^(rolex|tudor)$/i.test(model.brand) ? r.replace(/^m(?=\d)/i, '') : r);
  const expected = norm(model.reference), base = norm(baseReference(model.reference));
  return [...title.matchAll(/\b(?:ref(?:erence)?|viite|referenssi)\s*[.:#-]?\s*([a-z0-9][a-z0-9./-]{3,40})/gi)].some((m) => {
    if (!/\d/.test(m[1])) return false;
    const raw = m[1].replace(/[./-]+$/, '');
    const stated = norm(raw), statedBase = norm(baseReference(raw));
    return statedBase !== base || (expected !== base && stated !== statedBase && stated !== expected);
  });
}

export function exactMatch(
  title: string,
  model: Pick<Model, 'brand' | 'reference'> & Partial<Pick<Model, 'name'>>,
  details = '',
) {
  const reference = compact(model.reference),
    text = `${title}\n${details}`;
  const tokens = titleTokens(text);
  const generic = baseReference(model.reference) === model.reference.trim();
  const variantOfBase = generic && /^(rolex|tudor)$/i.test(model.brand) && new RegExp(`\\bm?${model.reference.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{3,4}\\b`, 'i').test(text);
  const found = tokens.has(reference) || (/^(rolex|tudor)$/i.test(model.brand) && tokens.has(`m${reference}`)) || variantOfBase;
  return (
    reference.length >= 4 &&
    compact(text).includes(compact(model.brand)) &&
    found &&
    !partsListing(title) &&
    !statedReferenceConflict(title, model) &&
    !titleDialConflict(title, model.name) &&
    !conflictingDial(text, model.name)
  );
}

/**
 * The listing names the catalog's base reference (126200 for 126200-0001) but not the variant suffix.
 * Sellers almost never write Rolex/Tudor suffixes, so these listings carry most of the market; they are
 * labelled "dial/bracelet not stated" and rejected when the title names a different dial color.
 */
export function referenceMatch(
  title: string,
  model: Pick<Model, 'brand' | 'reference'> & Partial<Pick<Model, 'name'>>,
  details = '',
) {
  const base = baseReference(model.reference);
  if (base === model.reference.trim() || wanted.test(title) || statedReferenceConflict(title, model)) return false;
  return exactMatch(title, { ...model, reference: base }, details) && !titleDialConflict(title, model.name);
}

/** exact: complete reference; reference: base reference, variant not stated; similar: same model line (never priced). */
export function classifyMatch(
  title: string,
  model: Pick<Model, 'brand' | 'reference'> & Partial<Pick<Model, 'name'>> & { family?: string },
  details = '',
): MatchKind | null {
  if (wanted.test(title)) return null;
  if (exactMatch(title, model, details)) return 'exact';
  if (referenceMatch(title, model, details)) return 'reference';
  return similarMatch(title, { brand: model.brand, name: model.name || '', family: model.family }) ? 'similar' : null;
}

/** Same brand and model line, without confirmation of the complete variant reference. Never used for prices. */
export function similarMatch(title: string, model: Pick<Model, 'brand' | 'name'> & { family?: string }) {
  const t = title.toLowerCase();
  if (!compact(t).includes(compact(model.brand)) || partsListing(title)) return false;
  const words = (model.name || '')
    .toLowerCase()
    .split(/[\s/]+/)
    .filter(Boolean);
  const line =
    words[0] && /^\d{2}(mm)?$/.test(words[1] || '')
      ? [words[0], words[1].replace('mm', '')]
      : [(model.family || words[0] || '').toLowerCase()];
  return line.every((w) => w && new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));
}
