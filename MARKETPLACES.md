# Connecting marketplaces

Watch pages combine these sources. Keys go in `.dev.vars` for local development (copy `.dev.vars.example`; it is never committed) and in the hosting provider's secrets for the published site. Restart `npm run dev` after changing `.dev.vars`.

| Source | Setup | What you get |
| --- | --- | --- |
| Phillips | None | **Blocked since 8 Nov 2026 (HTTP 403); shown as "blocked", retained results stay.** Public search + lot pages. Only published Sold For amounts with a matching brand/base reference and auction end date become reported sales. A complete variant reference is additionally required for an exact match. Estimates, current bids and login-only prices are excluded. |
| Tori.fi, FINN.no, Blocket, DBA | None | Live asking prices from Finland, Norway, Sweden and Denmark. The four sites share one classifieds platform and its structured data, so one parser reads all of them. Item pages supply the last-edited date. Titles marked sold (Solgt/Såld/Myyty) are kept as "sold · last ask". |
| WatchRecon | None | Index of ~15 watch forums' sale sections. In practice now mostly r/Watchexchange and r/Watch_Swap, plus TimeZone. Gives price, post date and brand per post. Replaces Reddit's public RSS, which Reddit blocked. Only the newest ~2 weeks are searchable per check (robots.txt disallows `last_days`); posts are archived, so history grows with use. |
| r/Watchexchange (RSS) | — | **Gone.** Reddit's public RSS returned HTTP 403 from 8 Nov 2026 and is retired on 13 Nov 2026. Reddit posts now arrive through WatchRecon. |
| r/Watchexchange (API) | Optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Also reads prices from the post body and searches the model line. New public API requests closed October 31, 2026; remaining public API access is scheduled to end March 2027. Approved access is required. |
| Kellofoorumi (FI), Klocksnack (SE), Tidssonen (NO) | None | Public RSS feeds of the sale sections (private ads / "Säljes" / "Marked – klokker"), read at most every 30 minutes and archived. Prices in the post are read in the forum's currency ("45 000 kr", "5000:-", "32 000,-"); "MYYTY", "SÅLD", "SOLGT" mark sold; wanted ads ("O:", "Köpes", "Kjøpes") are skipped. robots.txt allows the feeds. |
| Auctionet | None | Auctionet's public item API (Nordic, UK and EU auction houses, e.g. Stockholms Auktionsverk). Only lots in state *sold* count, at the winning bid, dated by the closing bid. Buyer's premium is **not** included. Searched by reference and by model family; Nordic houses rarely write modern references, so most matches are older references. |
| WatchUSeek (Private Sellers and Sponsors) | None | The forum's public RSS feed (newest ~35 sale threads). There is no usable search (robots.txt disallows `/search/`) and thread pages sit behind a JavaScript bot check, so WatchLedger **archives every thread it sees** (feed checked at most every 30 min, when a watch page is opened) and matches each watch against the archive. A price is used when the title or feed preview states one; matching threads without a visible price are listed with links so you can save them with the button. Coverage grows the longer the app is used. |
| eBay | Free keys, see below | Up to 50 active listings per watch from one eBay marketplace. |
| Chrono24 | Save button | No public API, and automated requests get a bot check. Use **Save to WatchLedger** on listings you view. Prices show Chrono24's 6.95% commission. |
| Facebook groups | Save button | Facebook removed its Groups API in 2024. The built-in **Facebook watch group** (`groups/1424920254386825`) gets a *Search group* link on every watch page (Facebook's own in-group search, while you are signed in to Facebook). Open a post, select its text, click **Save to WatchLedger**; posts from that group are tagged with it automatically. Add more groups under Sources → Add source with the group URL. |
| Any other site | Save button | Reads the page's structured price data or your selected text. |

## How matching decides what counts toward the price

- **Exact**: the listing names the complete catalog reference (`126200-0001`).
- **Same reference** (new): the listing names the base reference (`126200`) but not the variant suffix, and names no other dial colour or style (Ombré, Palm, Roman, Wimbledon…). Sellers almost never write Rolex/Tudor suffixes, so before this every Rolex and Tudor page had close to zero priced listings. These listings are labelled "dial/bracelet variant not stated". When 3 or more exact-variant prices exist, only those set the market price.
- **Similar**: same model line only. Never priced; hidden from the chart by default.
- Wanted ads (WTB, ostetaan, købes…), bracelet/link/strap sales ("bracelet for…", "lenke", "länk") are dropped. Titles that only *describe* the bracelet ("on Jubilee bracelet", "smooth bezel") are kept.
- Before the median is taken, cross-posts of the same watch (same title and price within 21 days) count once, and far-off prices (deposits, typos, parts) are dropped using the median absolute deviation (needs ≥5 prices). The price box says how many were dropped.

## eBay (about 10 minutes, free)

1. Sign up at https://developer.ebay.com (an ordinary eBay account works) and open **Application Keys**.
2. Create a **Production** keyset. **eBay keeps it disabled ("Non Compliant") until Marketplace Account Deletion is handled**; until then the keys fail with `invalid_client`. Open **Alerts & Notifications → Marketplace Account Deletion** and either:
   - **Use the built-in endpoint (recommended).** WatchLedger answers eBay at `/api/ebay/account-deletion`. Set `EBAY_DELETION_ENDPOINT` (the full public HTTPS URL of that route on your hosted site, exactly as you enter it at eBay) and `EBAY_VERIFICATION_TOKEN` (32–80 characters: letters, digits, `_`, `-`) as hosting secrets, deploy, then enter the same URL and token at eBay and press **Send Test Notification**. WatchLedger stores listing titles, prices and links but no eBay usernames or user IDs, so the endpoint only acknowledges.
   - **Or request the exemption** ("I do not persist eBay data"). Developers report mixed results; some keysets stay disabled.

   eBay cannot reach `localhost`, so this step needs the hosted site (or another public HTTPS URL). Once the keyset is enabled, the same keys work in `npm run dev` too.
3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)** into `.dev.vars`:
   ```
   EBAY_CLIENT_ID=YourApp-...-PRD-...
   EBAY_CLIENT_SECRET=PRD-...
   EBAY_MARKETPLACE=EBAY_DE
   ```
   `EBAY_MARKETPLACE` picks the site searched: `EBAY_DE`, `EBAY_US`, `EBAY_GB`, `EBAY_FR`, `EBAY_IT` or `EBAY_ES`.
4. Run `npm run ebay:check`: it tests the production and sandbox keys from `.dev.vars` without printing them. Then restart `npm run dev` and open a watch: the eBay chip should say "N found". If it says "credentials required", the production keyset is still disabled (step 2).

Listings are searched on `EBAY_MARKETPLACE` plus eBay US, GB and DE (up to 200 per site; about 10 Browse calls per watch refresh including new-watch offers, against roughly 5,000 calls/day on the free tier). An item listed on several eBay sites counts once, and prices keep the seller's currency (eBay US would otherwise show a €10,450 listing as $11,644).

### eBay sold prices

- **Automatic (needs eBay approval):** sold prices come only from eBay's Marketplace Insights API, a limited-release API. Apply for it for your application on developer.ebay.com. Once approved, the same keys start the **eBay sold** chip on watch pages: price paid and sale date of the last 90 days, as confirmed sales. Until then the chip says "not connected".
- **Now, from your browser:** search eBay for the watch, tick **Sold items** in the filters (the URL contains `LH_Sold=1`), then click **Save to WatchLedger**. WatchLedger lists every sale on that page, ticks the ones that match the chosen watch, and saves them with their sale date. A sale by accepted best offer is saved as **Sold · last ask**, because eBay hides the price paid. Prices are saved as eBay shows them on that page.

## Save to WatchLedger button

Open **Profile → Save from any website** (or the Sources page) and drag the green button to your bookmarks bar. On a listing page, click it: WatchLedger opens with the link, title and price filled in, suggests the matching reference, and saves the price to your history. The button runs only in your browser on the page you are viewing; listing data travels in the URL fragment, which is not sent to any server.

## Currency

Prices default to EUR; change it with the picker at the top right. Listings in other currencies (most r/Watchexchange and WatchUSeek posts are USD) are converted with the European Central Bank's daily reference rates (`/api/fx`; Frankfurter's copy of the same ECB data is used if the ECB host is unreachable). Converted prices show as "≈ €8,060 · Listed at $8,999 · converted", and saved records keep the original price and currency. Choose **Only EUR prices** in the filters to turn conversion off.

## Retail prices

Brand sites (rolex.com, tudorwatch.com, omegawatches.com and others) block automated requests (HTTP 403 from bot protection), so WatchLedger cannot fetch retail prices on its own. Instead:

1. On a watch page, the price box has **Find on rolex.com** (or the brand's site): a search limited to the brand's official site for that reference.
2. Open the model page in your browser and click **Save to WatchLedger**. On a brand's official site the button switches to **Retail price** automatically, reads the price from the page (select it first if it is not detected) and saves it with the page link and date.
3. The price box then shows the retail price with its source, and value retention / the risk score use it.

You can also type a retail price with **Enter**. Retail prices are kept per currency; Rolex and Tudor "M126200-0001" model numbers are recognised.

## Automatic archive and unattended refresh

Opening a catalog watch collects listings and saves a shared public-data archive in the existing D1 records table. Custom watch archives remain under the signed-in user's owner ID. Last-observed asking prices are not treated as verified active inventory; a missing listing is never inferred sold. The chart defaults to all price types and distinguishes reported sales, sold-marked last asks, current asking observations, and retained asks.

Each archive only grows: listings no longer found stay with their last observed price ("last observed"), and a listing whose price changes keeps its earlier prices (`priceChanges`, shown on the card as "Reduced from …").

**Storage.** Each listing is a row of its own (`lib/market-archive/storage.ts`); the watch's `market-history` row keeps only source chips, threads and which listings are live, so no row approaches D1's 2 MB limit. Listings of the watch's reference (any dial) load with the page; other models load only when **Show similar listings** is opened (`/api/market/live?similar=1`). A refresh rewrites only new or changed rows. Archives stored the old way (all listings inline) are converted at their next collection. Each catalog watch's search/card price is saved as a `market-summary` row when it is collected, and ECB rates are kept in D1 (`fx:ecb`) and renewed in the background.

**Background refresh.** A cron trigger (`*/5 * * * *` in `vite.config.ts`, handler `scheduled` in `worker/index.ts`) refreshes the most overdue watch every five minutes (`REFRESH_BATCH` raises the number per run). The plan (`lib/market-archive/refresh-plan.ts`):

1. The 45 most popular Rolex references (`POPULAR_ROLEX`), collected every six hours even if nobody opened them, **with eBay**.
2. Every other catalog watch someone has opened, every six hours, **without eBay** (eBay listings and chips from the last check are kept, not marked gone).

`POST /api/market/refresh` runs the same plan for one watch, for hosts without cron triggers (e.g. the six-hour Sites automation). It returns `refreshed`, `reason` (`popular` or `viewed`), `ebay` and `remaining`. It relies on the confirmed owner-only Sites gateway and the platform's service credential, never reads personal collection records and accepts no arbitrary URLs. Preserve the private audience when using this endpoint. Routine updates do not require a deployment.

**Watch pages open at once.** An archive up to a day old is shown immediately while a newer one is collected in the background; the page fetches again about 15 seconds later. **Refresh** still waits for new data.

**eBay call budget.** eBay calls are counted per UTC day in D1 (`ebay-usage:<date>` records). A refresh uses about 12 calls (17 once Marketplace Insights is approved). Background refreshes stop at 3,000 calls a day, which covers the popular Rolexes four times a day; all eBay use stops at 4,800, below eBay's 5,000. Set `EBAY_BACKGROUND_CALLS` / `EBAY_DAILY_CALLS` to change them. When a limit is reached, the eBay chips say so and the last eBay listings are kept.

Local testing: under `npm run dev`, `curl http://localhost:5173/cdn-cgi/handler/scheduled` runs one scheduled refresh. Wrangler's built preview (`npm start`) cannot pass the schedule event to this worker (`DataCloneError: ScheduledController`), a local tooling limitation.

Phillips coverage is the first search page, at most eight sold lot details per lookup. Amounts are the auction house's reported totals, not normalized hammer prices or seller proceeds. Public availability does not itself establish redistribution rights. Chrono24 remains blocked and is not represented as an automatic data source.

## Additional auction sources (8 November 2026)

Antiquorum is collected from the first public reference-search page (up to 30 lots). Only an explicit `Sold:` amount with an auction date is imported. Estimates, current bids, missing outcomes and multi-watch bundles are excluded. Reported amounts retain their original currency; their fee basis is unspecified unless established by the source.

Christie’s global search endpoint currently returns HTTP 404, but its public online catalogues work. Automatic coverage starts with the Geneva online sales of December 2023 (3335) and October 2026 (3914), up to four cumulative pages per catalogue. Only `price_realised`, not `current_bid` or an estimate, becomes a reported sale. The catalogue describes results as including buyer’s premium. Unsold, withdrawn, open and future lots are excluded. This is selected-catalogue coverage, not the complete Christie’s archive.

Both collectors feed the same persistent archive, source filters, reported-sale graph series and unattended refresh. Auction venue is not assumed to be seller location. Dial descriptions are retained for archive reclassification. Separate auction lots are not collapsed merely because their model, amount and date coincide.

Bukowskis and Cheffins publish numeric results but local fetching encountered HTTP 202 challenges; Kaplans returned 403. Bonhams has published result evidence, but an automatic collector is not verified. These sources are listed as not connected and supply no automatic prices. Loupe This and Collecting.com require sign-in for final prices. Catawiki remains blocked. No estimate or last bid from those sources is presented as a sale.

The eBay Marketplace Insights sold-history API is restricted and not open to new users; new Browse API credentials enable active listings, not a general sold-price feed. Public page access does not itself establish redistribution rights.

## Variant matching

Discovery searches may use the base reference, but automatic exact matches must contain the full catalog reference. `126200` does not confirm `126200-0001`; a different suffix does not match. Rolex-style `M126200-0001` and reference punctuation are normalized. Explicit conflicting dial colors are rejected when the catalog has one recognizable dial color; case and strap colors are not treated as dial evidence. Missing dial details are not inferred from photos.

Similar models and unverified variants stay outside market-price calculations and are hidden from the main graph by default. The detail view can show them explicitly for context. Previously collected archives use these rules immediately when read; manually assigned observations keep their selected model.

## Finnish shop and used-market prices

- **Kellotux.com**: public used-market listings from its `api.kellotux.com` backend, searched by the dedicated reference field (first 60 results). Brand, reference, dial and diameter are checked; wanted, collection, deleted and expired entries are skipped. Box/papers data is retained. Original dealer URLs deduplicate imported ads without following them or fetching contact information. A sold flag gives `sold-asking`; a separate positive `sold_price` with `sold_on_site` is labelled seller-reported. The source has no sale-date field, so those sales are observed now and do not inherit the original posting date. Older `.fi` links normalize to `.com` during refresh without creating duplicate observations.
- **Laatukellot.fi**: public search suggestions expose exact product reference, dial, diameter, availability and current shop price. `type=watch` is a new-watch shop offer; `used_watch` is a used dealer asking price. The `new` badge means a recent listing, not necessarily a new watch. `rrp`, stock counts and `num_sold` are not sale results. Out-of-stock or unavailable products do not become sold deals.
- **Keskisen Kello**: public storefront search, using the search-only configuration published by the shop. Typo tolerance and automatic word removal are disabled. Only available watches naming the reference qualify; suggested nearby models, straps and accessories are rejected. No customer account or private order data is accessed.
- **Huuto.net**: the official public closed-items API for men's/women's wristwatches, up to four matching detail pages per check. A public `purchases` link is required as evidence that the closed item sold; its private contents are never requested. A sold auction with bidders and a met reserve uses its closing bid. A fixed-price sold listing is `sold-asking` because the accepted offer may be undisclosed. A closed unsold listing is excluded.

New-watch offers are stored in `retailOffers`, separately from used-market listings. They appear as **Shop price (new)** and a linked offer comparison, and do not enter the used-market graph or become official MSRP. The manual official-retail value remains the value-retention baseline. Failed or disappeared shop offers remain archived as last observed, but are not advertised as current offers. The next archive read refreshes older collector versions once, then returns to the normal cache/refresh cadence.

Structured seller identity survives archive reclassification. Different explicit reference suffixes, known dial conflicts and material size discrepancies cannot become an exact variant match. A reference named in the title cannot be overridden by a different reference mentioned later in a description. All-dials mode deliberately compares variants of the same base reference; choosing a dial narrows that evidence.

Sources: [Kellotux listings](https://kellotux.com/listings), [Laatukellot example](https://www.laatukellot.fi/tudor/black-bay/m79030n-0001/316702), [Keskisen Kello search](https://www.keskisenkello.fi/catalogsearch/result/?q=SPB103J1), [Huuto public item and sold-marker documentation](https://dev.huuto.net/viite/ilmoitukset), [Huuto category/closed-item documentation](https://dev.huuto.net/viite/osastot).
