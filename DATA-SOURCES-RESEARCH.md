# Price data sources: research and audit (8 Nov 2026)

How WatchLedger can get accurate prices from each platform, what was wrong with the prices it showed, and what was changed. Every "Tested" result below is a live request made on 8 Nov 2026 with WatchLedger's normal user agent (no bot-protection workarounds).

## Added auction collectors

Antiquorum now imports explicit sold amounts and dates from its first public reference-search page. Christie’s global search returns 404, but public online catalogues work: the December 2023 and October 2026 Geneva catalogues are now collected automatically (up to four cumulative pages each). This is bounded selected-catalogue coverage, not the whole archive. Both feed the persistent market archive and existing graph/source filters.

A live Rolex 124300 check returned two Antiquorum results and four Christie’s results, with other dials/references kept as similar context. Matching examples included Christie’s CHF 7,560 realized result (12 Dec 2023) and Antiquorum’s EUR 8,060 result (18 Jan 2022). The Christie’s CHF 6,000 current-bid field is deliberately ignored. Multi-watch bundles, estimates, missing outcomes, open/future and withdrawn lots are not single-watch sales. Dial evidence survives archive reclassification. Equal auction amounts/titles do not merge separate lots.

Bukowskis and Cheffins public results were verified, but direct requests hit HTTP 202 challenges. Kaplans returned 403. Those sources and the unverified Bonhams collector are labelled not connected in the source directory. Loupe This and Collecting.com require sign-in for final prices. The research below predates these additions where stated otherwise.

The unattended six-hour Sites refresh already exists and now includes the new collectors; no duplicate schedule is needed. eBay’s official Marketplace Insights API is not open to new users. A paid data vendor’s coverage, settlement-price provenance and display license remain unverified; do not assume that buying access permits a competing tracker.

## 1. What was wrong with the market price

| Problem | Effect | Status |
| --- | --- | --- |
| Exact matching required the catalog's full variant suffix (`126200-0001`). Sellers almost never write it. 6,564 catalog entries have suffixes, including essentially all Rolex and Tudor. | On 24 live Nordic listings for a Datejust 126200, **1** counted toward the price. Submariner 124060, Datejust 126200 and Black Bay 58 pages had **0** priced listings. | **Fixed**: new "same reference" match level (base reference, no conflicting dial colour/style), labelled on each listing. Live re-test: 124060 → 33 priced listings, 79030N → 6, 126200-0001 → 2 (Ombré, Palm, Wimbledon and other dials correctly excluded). |
| Any title containing "bracelet", "strap" or "bezel" was treated as a parts sale. | Dropped normal listings: "…Smooth Bezel, Jubilee Bracelet Ref. 126200", "Speedmaster on bracelet". | **Fixed**: only parts phrasing ("bracelet for…", "bezel insert", "lenke", "länk", "Seiko SPB143 strap") is excluded. |
| Wanted ads (WTB, ostetaan, købes, söker…) could match. | A buyer's budget counted as an asking price. | **Fixed**. |
| "Sold" was only recognised in English. | Norwegian "Solgt", Swedish "Såld", Finnish "Myyty" stayed "asking". | **Fixed**. |
| No outlier handling. | One deposit, typo or parts price moves a small median. | **Fixed**: median-absolute-deviation filter (≥5 prices); the price box says how many were excluded. |
| Cross-posts counted multiple times. | The same watch on Reddit + a forum + classifieds weighted 2–3×. | **Fixed**: same title (sale prefixes stripped) and price within 2% inside 21 days counts once. |
| 1-year change compared the first week's median with the last week's. | With sparse data, one listing in one week decided the "performance" figure. | **Fixed**: first-quarter median vs latest-quarter median, ≥3 prices each, otherwise "not enough data". |
| Reddit RSS and Phillips now return HTTP 403, and were reported as "error". | Any error marks the archive partial → cache only 2 min → **every page view re-ran all collectors**. | **Fixed**: 401/403/429 are reported as "blocked", which no longer shortens the cache. |
| NOK, SEK, DKK were not accepted currencies. | Nordic listings would fail validation. | **Fixed** (ECB publishes all three). |

Still open (not changed):
- Asking and sold prices are pooled for "Market price". Asks usually sit above transaction prices, so the market price leans high where sales are scarce. The separate "Sold price" row is the better transaction estimate.
- Auction results (Phillips) include buyer's premium; they are not normalised to hammer price.
- ECB has no TWD, AED or VND rates.
- An earlier checkout lacked the macOS rolldown binary; subsequent local publication builds succeeded after dependency repair. Current release checks are run again before publishing.

## 2. Platform by platform

| Platform | Tested 8 Nov 2026 | Official access | Best legitimate route | In WatchLedger |
| --- | --- | --- | --- | --- |
| **Tori.fi** (FI) | 200, structured data | none needed | Public search + item pages | ✅ live |
| **FINN.no** (NO) | 200, same platform as Tori | none needed | Same parser | ✅ **new** |
| **Blocket** (SE) | 200, same platform | none needed | Same parser | ✅ **new** |
| **DBA** (DK) | 200, same platform | none needed | Same parser | ✅ **new** |
| **WatchRecon** (15 forums) | 200; robots.txt allows `/?query=` | none | Search per reference, archive results | ✅ **new** (now mostly r/Watchexchange, r/Watch_Swap, TimeZone) |
| **Reddit r/Watchexchange** | RSS **403** ("blocked due to a network policy") | RSS retired 13 Nov 2026; new API keys closed 31 Oct 2026; public API ends March 2027 | WatchRecon (above); commercial Reddit data licence otherwise | Reddit direct marked "blocked" |
| **WatchUSeek** | RSS 200 | none | Public RSS, archived | ✅ unchanged |
| **Omega Forums, TZ-UK, Rolex Forums, UhrForum** | 403 / Cloudflare challenge | none | Partly via WatchRecon; otherwise manual | — |
| **eBay** | Sandbox keys work; production keys `invalid_client` (keyset disabled until Marketplace Account Deletion is handled). Endpoint `/api/ebay/account-deletion` and `npm run ebay:check` added | Browse API (active listings, free). Sold prices: Marketplace Insights, limited release, approval rarely granted | **Fix the production keyset** (Marketplace Account Deletion exemption). Biggest global source still unused. | Code ready; keys rejected |
| **Chrono24** | Cloudflare challenge | No public API or partner feed found | (a) Browser-extension capture of pages you view; (b) WatchCharts API (licensed, Chrono24-heavy market data): Pay-as-you-go $99/mo + credits, Level 1 $600/mo, internal-use licence | Bookmarklet only |
| **Catawiki** | Akamai "Access Denied" | No public API. Partner network (Awin/TradeTracker) offers product feeds of *live* lots; directory listings show programs closed | (a) Browser-extension capture of lot/result pages; (b) apply to the Catawiki partner network for the feed (asks/estimates, not results) | Bookmarklet only |
| **Phillips** | **403** maintenance/block page since 8 Nov | none | Retry later; retained results are kept | Marked "blocked" |
| **Bonhams** | 200; search embeds full lot JSON (hammer, premium, currency, end date) | none | Upcoming lots are in the HTML; **past results load client-side** (likely Algolia). Next candidate after checking terms. | — |
| **Christie's / Sotheby's** | 200 JS app / redirect | none | Same investigation as Bonhams | — |
| **Facebook groups / Marketplace** | — | Groups API removed 2024 | Existing "Import group posts" + save button; extension capture | Manual |
| **Telegram sale channels** | `t.me/s/<channel>` 200 | Bot API only for channels you admin | Public web preview of *public* channels; prices from text via `extractPrice` | — (good next step) |
| **Kleinanzeigen (DE)** | 200 | No public API | Terms §5 forbid crawlers/scrapers without written consent | — not added |
| **Marktplaats (NL)** | 200, prices in page data | No public API | Claims database right over its ads | — not added |
| **Kellofoorumi (FI)** private ads | RSS 200, 50 posts, ~58% priced | none | Public RSS, archived | ✅ **new** |
| **Klocksnack (SE)** "Säljes, Bytes, Köpes" | RSS 200, 60 posts, ~33% priced; crawl-delay 5 s | none | Public RSS, archived | ✅ **new** |
| **Tidssonen (NO)** "Marked – klokker" | RSS 200, 20 posts, ~65% priced; crawl-delay 60 s | none | Public RSS, archived | ✅ **new** |
| **Auctionet** (Nordic/UK/EU houses) | Public item API `api/v2/items.json` 200: state, bids, currency, close time | none needed | Sold lots at winning bid (premium excluded) | ✅ **new** |
| **Tradera (SE)** | Captcha; official API has no sold data | Developer API (active items) | — | — |
| **Lauritz, Bruun Rasmussen, Dorotheum, Heritage, Sotheby's** | 403 / captcha | none | Manual | — |
| **Leboncoin, Subito, Ricardo, Vinted, Mercari, Yahoo! Auctions JP** | DataDome / Cloudflare / 403 | none | Manual | — |
| **EveryWatch** | robots.txt disallows | Paid (~$49/mo), no public API found | Licensed data only | — |
| **Chronext** | 200 but prices load client-side | none | — | — |
| **Huuto.net (FI)** | Cloudflare challenge | — | Manual | — |
| **Bob's Watches and other dealers** | 200 | — | Dealer asks; useful as "dealer price" reference | — |

Third-party scraping services (Apify actors, ScrapingBee, etc.) exist for Chrono24, Catawiki, Kleinanzeigen and WatchCharts. They work by getting past the sites' bot protection, which the project's rules exclude. They were **not** adopted. One Catawiki "sold prices" actor also reports its index misses most lots from the last 6 weeks.

## 3. Recommended next steps (in order of value)

1. **eBay production keys.** Free, official, global, ~5,000 calls/day. The collector is finished; only the keyset needs enabling.
2. **Browser extension instead of the bookmarklet** (Chrome/Edge, Manifest V3). While you browse Chrono24, Catawiki (including closed-lot results) or a Facebook group, it reads the prices on pages you are already viewing and sends them to `/api/records`. It runs in your own signed-in browser session, with no bot evasion. It is the only legitimate way to get Chrono24/Catawiki at volume without a licence.
3. **Scheduled refresh.** The existing six-hour Sites automation calls `POST /api/market/refresh`, including the new auction sources. WatchRecon has limited recent coverage, so steady collection builds history.
4. **Bonhams results**, then Christie's/Sotheby's: real transaction prices with dates. Confirm terms first; they would replace Phillips.
5. **Telegram public sale channels**: cheap to add with the existing price extractor.
6. **WatchCharts API**, if a paid benchmark is acceptable: it covers Chrono24 and is licensed. Internal use only unless a distribution licence is bought.

## Sources

- Reddit RSS/API timeline: [TechRepublic](https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/), [ppc.land](https://ppc.land/reddit-to-halt-public-data-api-access-in-march-2027-as-14-000-apps-register/), [MediaNama](https://www.medianama.com/2026/10/223-reddit-rss-feeds-public-api-bots/)
- eBay Marketplace Insights: [eBay buying-app guide](https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application), [SoldComps overview](https://www.soldcomps.io/blog/ebay-marketplace-insights-api-access), [DEV: findCompletedItems is gone](https://dev.to/trawl/ebay-sold-listings-api-in-2026-findcompleteditems-is-gone-heres-what-still-works-2407)
- WatchCharts API: [Getting started](https://watchcharts.com/api), [Documentation](https://watchcharts.com/api/documentation), [Pricing](https://watchcharts.com/subscribe), [Extension](https://watchcharts.com/extension)
- Catawiki partner network: [Catawiki story](https://www.catawiki.com/stories/5613-monetise-your-web-traffic-with-the-catawiki-partner-network), [affi.io listing](https://affi.io/m/catawiki); scraper index lag: [Apify sold-prices actor](https://apify.com/phantom_coder/catawiki-sold-prices-scraper)
- Chrono24 (no official API; Cloudflare): [irahorecka/chrono24](https://github.com/irahorecka/chrono24), [ScrapingBee page](https://www.scrapingbee.com/scrapers/chrono24-api/)
- Telegram web preview: [Apify public channel scraper](https://apify.com/sweet_stickball/telegram-public-channel-scraper)
- WatchRecon coverage: https://www.watchrecon.com/faq.php; robots: https://www.watchrecon.com/robots.txt
