/**
 * Price collection. Layout:
 *   core/      shared building blocks: listing schema, errors, HTTP, results, text, price and date parsing
 *   matching/  decides whether a listing title is this watch (exact / same reference / similar / not it)
 *   services/  one file per source: parse its pages and collect from it
 *   live.ts    runs the marketplace services for a watch page; manual.ts serves on-demand collection
 */
export * from './core/dates';

export * from './core/errors';

export * from './core/http';

export * from './core/listing';

export * from './core/price';

export * from './core/result';

export * from './core/text';

export * from './matching/classify';

export * from './matching/keywords';

export * from './matching/reference';

export * from './services/auctions';

export * from './services/auctions/antiquorum';

export * from './services/auctions/auctionet';

export * from './services/auctions/christies';

export * from './services/auctions/phillips';

export * from './services/chrono24';

export * from './services/ebay';

export * from './services/forums';

export * from './services/recommerce';

export * from './services/reddit';

export * from './services/watchrecon';

export * from './live';

export * from './manual';
