# Connecting marketplaces

Watch pages combine these sources. Keys go in `.dev.vars` for local development (copy `.dev.vars.example`; it is never committed) and in the hosting provider's secrets for the published site. Restart `npm run dev` after changing `.dev.vars`.

| Source | Setup | What you get |
| --- | --- | --- |
| Tori.fi | None | Live asking prices (Finland), searched on every watch page. |
| r/Watchexchange | None | Reddit's public RSS search. `[WTS]`/`[WTT]` posts from the last year whose **title** states a price, plotted on their post date. Reddit rate-limits this feed; results are cached for 20 minutes per watch, and the last good results are reused for up to 24 hours while Reddit is limiting. |
| r/Watchexchange (API) | Optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Also reads prices from the post body and searches the model line. Reddit now reviews new API apps, so this may need approval. |
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

Prices default to EUR. Change the currency with the picker at the top right; it is remembered in your browser. Currencies are never converted: a listing only appears when it was priced in the selected currency (r/Watchexchange posts are mostly USD).

## Retail prices

Brand sites (rolex.com, tudorwatch.com, omegawatches.com and others) block automated requests (HTTP 403 from bot protection), so WatchLedger cannot fetch retail prices on its own. Instead:

1. On a watch page, the price box has **Find on rolex.com** (or the brand's site): a search limited to the brand's official site for that reference.
2. Open the model page in your browser and click **Save to WatchLedger**. On a brand's official site the button switches to **Retail price** automatically, reads the price from the page (select it first if it is not detected) and saves it with the page link and date.
3. The price box then shows the retail price with its source, and value retention / the risk score use it.

You can also type a retail price with **Enter**. Retail prices are kept per currency; Rolex and Tudor "M126200-0001" model numbers are recognised.
