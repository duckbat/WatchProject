/** One key per eBay item: the same item is listed on several eBay sites (ebay.de/itm/1 and ebay.com/itm/1). */
export function ebayItemKey(url: string) {
  const m = url.match(/^https:\/\/(?:www\.)?ebay\.[a-z.]+\/itm\/(?:[^/?#]+\/)?(\d{9,15})(?:[/?#]|$)/);
  return m ? `https://www.ebay.com/itm/${m[1]}` : undefined;
}
