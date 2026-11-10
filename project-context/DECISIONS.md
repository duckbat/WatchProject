# Decision Log

Record architectural/product decisions here, newest first.

| Date | Decision | Reason |
|------|----------|--------|
| 2026-11-09 | Market archives are stored one row per listing (storage version 2); the archive row keeps metadata only. Other models load on request. Search summaries are saved per watch at collection; ECB rates persist in D1; the catalog loads on first use; index `records_owner_kind` (migration 0001) | Archive rows were heading for D1's 2 MB row limit (519 KB after two eBay refreshes; 72% other models); the first search per instance took 1.1–3.8 s |
| 2026-11-09 | Background refresh every 5 minutes (cron trigger + the existing refresh endpoint): 45 popular Rolexes every 6 h with eBay, other viewed watches every 6 h without eBay; eBay calls counted per day in D1 (background ≤ 3,000, total ≤ 4,800) | Pages open with recent data; eBay's ~5,000 calls/day go to the most popular Rolexes |
| 2026-11-09 | Watch pages serve an archive up to 24 h old immediately and refresh it in the background | A full collection takes ~9 s (about 40 source requests) |
| 2026-11-09 | Archived listings keep earlier prices when a price changes (`priceChanges`) | Old data is kept and new observations are added, never overwritten |
| 2026-11-09 | eBay listings are searched on the configured site plus eBay US, GB and DE (200 per site), merged per eBay item, and keep the seller's own currency | One site showed ~10% of the market (eBay DE 28 vs US 199 for a 124060); eBay US converts foreign prices, which the project never does |
| 2026-11-09 | eBay sold prices come from Marketplace Insights once eBay approves the app; until then from eBay's sold-items search page via the Save to WatchLedger button | eBay offers sold data only through that approved API; scraping eBay from the server is against its terms. An accepted best offer is saved as "Sold · last ask", not as a confirmed sale |
| 2026-11-09 | The "EU" region is shown as "Europe" and includes all Nordic countries (also NO, IS); listings without a stated country take their source's home country | Nordic sources (FINN, Tidssonen, Laatukellot) must count in Europe |
| 2026-11-09 | Merged the WatchLedger app history into this repository (TypeScript, React/vinext on Cloudflare Workers, D1) | The app was built in a separate local history; merging keeps both |
| 2026-11-08 | Created `project-context/` to hold project context for ongoing work | Keep shared context in the repo |
