# Connecting marketplaces

Watch pages combine these sources. Keys go in `.dev.vars` for local development (copy `.dev.vars.example`; it is never committed) and in the hosting provider's secrets for the published site. Restart `npm run dev` after changing `.dev.vars`.

| Source | Setup | What you get |
| --- | --- | --- |
| Phillips | None | **Blocked since 8 Nov 2026 (HTTP 403); shown as "blocked", retained results stay.** Public search + lot pages. Only published Sold For amounts with a matching brand/base reference and auction end date become reported sales. A complete variant reference is additionally required for an exact match. Estimates, current bids and login-only prices are excluded. |
| Tori.fi, FINN.no, Blocket, DBA | None | Live asking prices from Finland, Norway, Sweden and Denmark. The four sites share one classifieds platform and its structured data, so one parser reads all of them. Item pages supply the last-edited date. Titles marked sold (Solgt/Såld/Myyty) are kept as "sold · last ask". |
| WatchRecon | None | Index of ~15 watch forums' sale sections. In practice now mostly r/Watchexchange and r/Watch_Swap, plus TimeZone. Gives price, post date and brand per post. Replaces Reddit's public RSS, which Reddit blocked. Only the newest ~2 weeks are searchable per check (robots.txt disallows `last_days`); posts are archived, so history grows with use. |
| r/Watchexchange (RSS) | — | **Gone.** Reddit's public RSS returned HTTP 403 from 8 Nov 2026 and is retired on 13 Nov 2026. Reddit posts now arrive through WatchRecon. |
| r/Watchexchange (API) | Optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Also reads prices from the post body and searches the model line. New public API requests closed October 31, 2026; remaining public API access is scheduled to end March 2027. Approved access is required. |
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
2. Create a **Production** keyset. eBay asks about *Marketplace Account Deletion* notifications first: choose the option saying you do **not persist eBay user data** to get an exemption. WatchLedger only stores prices and listing links you choose to save.
3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)** into `.dev.vars`:
   ```
   EBAY_CLIENT_ID=YourApp-...-PRD-...
   EBAY_CLIENT_SECRET=PRD-...
   EBAY_MARKETPLACE=EBAY_DE
   ```
   `EBAY_MARKETPLACE` picks the site searched: `EBAY_DE`, `EBAY_US`, `EBAY_GB`, `EBAY_FR`, `EBAY_IT` or `EBAY_ES`.
4. Restart `npm run dev` and open a watch: the eBay chip should say "N found". If it says "error", hover it for eBay's message.

The Browse API gives active listings only (about 5,000 calls/day on the free tier). Sold prices need eBay's Marketplace Insights API, which requires approval.

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

`POST /api/market/refresh` refreshes one previously viewed public catalog reference due after six hours, oldest first. It returns `refreshed` and `remaining`; a scheduled run can call it repeatedly. This shared updater relies on the confirmed owner-only Sites gateway and the platform's service credential. It never reads personal collection records or accepts arbitrary URLs. Preserve the private audience when using this endpoint. Routine updates do not require a deployment.

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
