# Connecting marketplaces

Watch pages combine these sources. Keys go in `.dev.vars` for local development (copy `.dev.vars.example`; it is never committed) and in the hosting provider's secrets for the published site. Restart `npm run dev` after changing `.dev.vars`.

| Source | Setup | What you get |
| --- | --- | --- |
| Tori.fi | None | Live asking prices (Finland), searched on every watch page. |
| r/Watchexchange | None | Reddit's public RSS search. `[WTS]`/`[WTT]` posts from the last year whose **title** states a price, plotted on their post date. Reddit rate-limits this feed; results are cached for 20 minutes per watch. |
| r/Watchexchange (API) | Optional `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Also reads prices from the post body and searches the model line. Reddit now reviews new API apps, so this may need approval. |
| eBay | Free keys, see below | Up to 50 active listings per watch from one eBay marketplace. |
| Chrono24 | Save button | No public API, and automated requests get a bot check. Use **Save to WatchLedger** on listings you view. Prices show Chrono24's 6.95% commission. |
| Facebook groups | Save button | Facebook removed its Groups API in 2024. Open the post, select its text, click **Save to WatchLedger**. |
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
