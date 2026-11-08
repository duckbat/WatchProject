const excluded =
  /\b(strap|bracelet|bezel insert|bezel only|dial only|parts|replica|homage|ranneke|varaosat|box only|laatikko|lenke|lenker|länk|länkar|links? only)\b/i;

/** A part sold for a watch ("bracelet for 126200", "Seiko SPB143 strap"), not the watch. "On Jubilee bracelet" describes a watch. */
const wornOn =
  /\b(on|with|w\/|jubilee|oyster|president|oysterflex|steel|original|full|and|\+|&)\s+(bracelet|strap)s?\b/gi;

const partFor = /\b(bracelet|strap|bezel|clasp|links?|lenke|länk)\s+(for|fits|to fit|til|för|für)\b/i;

export const partsListing = (title: string) => partFor.test(title) || excluded.test(title.replace(wornOn, ' '));

/** Wanted ads name the watch and a budget, not a price anyone asked. */
export const wanted =
  /(\[\s*wtb|\bwtb\b|want(?:ed)? to buy|\blooking for\b|\bostetaan\b|\bostan\b|\bkjøpes\b|\bkøbes\b|\bköpes\b|\bsøker\b|\bsöker\b|\bsuche\b|\betsitään\b|^\s*o:\s)/i;

/** "Sold" in the languages of the supported marketplaces. */
export const soldWord = /(\[\s*sold|\bsold\b|\bsolgt\b|\bsåld\b|\bmyyty\b|\bverkauft\b|\bvenduto\b|\bvendu\b)/i;
