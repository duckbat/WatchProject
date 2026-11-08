# Connecting marketplaces

Watch pages combine these sources. Keys go in `.dev.vars` for local development (copy `.dev.vars.example`; it is never committed) and in the hosting provider's secrets for the published site. Restart `npm run dev` after changing `.dev.vars`.

| Source | Setup | What you get |
| --- | --- | --- |
| Phillips | None | Public search + lot pages. Only published Sold For amounts with a matching brand/base reference and auction end date become reported sales. A complete variant reference is additionally required for an exact match. Estimates, current bids and login-only prices are excluded. |
| Tori.fi | None | Live asking prices (Finland), searched on every watch page. |
| r/Watchexchange | None | Reddit's public RSS search, available only until its announced retirement on November 13, 2026. `[WTS]`/`[WTT]` posts from the last year whose **title** states a price, plotted on their post date. Reddit rate-limits this feed; checks are spaced at least one minute apart and observations are retained in D1 when a later request fails. |
| r/Watchexchange (API) | Optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Also reads prices from the post body and searches the model line. New public API requests closed October 31, 2026; remaining public API access is scheduled to end March 2027. Approved access is required. |
| WatchUSeek (Private Sellers and Sponsors) | None | The forum's public RSS feed (newest ~35 sale threads). There is no usable search (robots.txt disallows `/search/`) and thread pages sit behind a JavaScript bot check, so WatchLedger **archives every thread it sees** (feed checked at most every 30 min, when a watch page is opened) and matches each watch against the archive. A price is used when the title or feed preview states one; matching threads without a visible price are listed with links so you can save them with the button. Coverage grows the longer the app is used. |
| eBay | Free keys, see below | Up to 50 active listings per watch from one eBay marketplace. |
| Chrono24 | Save button | No public API, and automated requests get a bot check. Use **Save to WatchLedger** on listings you view. Prices show Chrono24's 6.95% commission. |
| Facebook groups | Save button | Facebook removed its Groups API in 2024. The built-in **Facebook watch group** (`groups/1424920254386825`) gets a *Search group* link on every watch page (Facebook's own in-group search, while you are signed in to Facebook). Open a post, select its text, click **Save to WatchLedger**; posts from that group are tagged with it automatically. Add more groups under Sources → Add source with the group URL. |
| Any other site | Save button | Reads the page's structured price data or your selected text. |

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

## Variant matching

Discovery searches may use the base reference, but automatic exact matches must contain the full catalog reference. `126200` does not confirm `126200-0001`; a different suffix does not match. Rolex-style `M126200-0001` and reference punctuation are normalized. Explicit conflicting dial colors are rejected when the catalog has one recognizable dial color; case and strap colors are not treated as dial evidence. Missing dial details are not inferred from photos.

Similar models and unverified variants stay outside market-price calculations and are hidden from the main graph by default. The detail view can show them explicitly for context. Previously collected archives use these rules immediately when read; manually assigned observations keep their selected model.
