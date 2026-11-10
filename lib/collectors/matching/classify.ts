import type { Model } from '../../market';
import type { MatchKind } from '../core/listing';
import { conflictingDial, titleDialConflict } from './dial';
import { partsListing, wanted } from './keywords';
import { baseReference, compact, titleTokens } from './reference';

function statedReferenceConflict(title: string, model: Pick<Model, 'brand' | 'reference'>) {
  const norm = (r: string) => compact(/^(rolex|tudor)$/i.test(model.brand) ? r.replace(/^m(?=\d)/i, '') : r);
  const expected = norm(model.reference), base = norm(baseReference(model.reference));
  // "Ref. 124060LN" states the same watch as catalog reference 124060 (see letteredReference).
  const lettersAllowed = /^(rolex|tudor)$/i.test(model.brand) && /^\d{5,6}$/.test(base) && !DISTINCT_LETTERED_REFERENCES.has(base);
  const unletter = (r: string) => (lettersAllowed ? r.replace(new RegExp(`^${base}[a-z]+(?=\\d{4}$|$)`), base) : r);
  return [...title.matchAll(/\b(?:ref(?:erence)?|viite|referenssi)\s*[.:#-]?\s*([a-z0-9][a-z0-9./-]{3,40})/gi)].some((m) => {
    if (!/\d/.test(m[1])) return false;
    const raw = m[1].replace(/[./-]+$/, '');
    const stated = unletter(norm(raw)), statedBase = unletter(norm(baseReference(raw)));
    return statedBase !== base || (expected !== base && stated !== statedBase && stated !== expected);
  });
}

/**
 * Numeric Rolex/Tudor references whose lettered form is a different catalog model (116400 vs 116400GV, the
 * green-crystal Milgauss). For these the letters must match exactly. tests/catalog.test.mjs keeps this list in step
 * with the catalog.
 */
export const DISTINCT_LETTERED_REFERENCES = new Set(['116185', '116400', '116518', '116519', '228235']);

/**
 * Sellers write the bezel/dial letters after a numeric Rolex/Tudor reference ("124060LN", "124060BKSO"), sometimes
 * glued to the next word ("124060Complete"). For a numeric catalog reference those letters name the same watch.
 */
function letteredReference(tokens: Set<string>, reference: string) {
  if (!/^\d{5,6}$/.test(reference) || DISTINCT_LETTERED_REFERENCES.has(reference)) return false;
  const lettered = new RegExp(`^m?${reference}[a-z]+$`);
  return [...tokens].some((t) => lettered.test(t));
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
  const rolexLike = /^(rolex|tudor)$/i.test(model.brand);
  const variantOfBase = generic && rolexLike && new RegExp(`\\bm?${model.reference.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{3,4}\\b`, 'i').test(text);
  const found = tokens.has(reference) || (rolexLike && (tokens.has(`m${reference}`) || letteredReference(tokens, reference))) || variantOfBase;
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
