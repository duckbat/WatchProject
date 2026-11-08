import type { Model } from '../../market';
import type { ListingIdentity, MatchKind } from '../core/listing';
import { conflictingDial, titleDialConflict } from './dial';
import { partsListing, wanted } from './keywords';
import { baseReference, compact } from './reference';

/** A seller's dedicated reference field outranks search terms, descriptions and model-family names. */
export function classifyIdentity(title: string, model: Model, identity: ListingIdentity, details = ''): MatchKind | null {
  if (typeof identity.brand !== 'string' || typeof identity.reference !== 'string' || compact(identity.brand) !== compact(model.brand) || partsListing(title) || wanted.test(title)) return null;
  const normalize = (ref: string) => compact(/^(rolex|tudor)$/i.test(model.brand) ? ref.replace(/^m(?=\d)/i, '') : ref);
  const observed = normalize(identity.reference), expected = normalize(model.reference);
  if (observed.length < 4 || normalize(baseReference(identity.reference)) !== normalize(baseReference(model.reference))) return null;
  const match = observed === expected ? 'exact' : observed === normalize(baseReference(model.reference)) || expected === normalize(baseReference(identity.reference)) ? 'reference' : 'similar';
  const size = Number(model.size?.replace(',', '.').match(/[\d.]+/)?.[0]);
  if (identity.sizeMm && size && Math.abs(identity.sizeMm - size) > 0.75) return 'similar';
  if (conflictingDial(`${identity.dial ? `Dial: ${identity.dial}` : ''}\n${details}`, model.name) || titleDialConflict(title, model.name)) return 'similar';
  return match;
}
