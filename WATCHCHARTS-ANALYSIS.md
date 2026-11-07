# How WatchCharts is built (REA analysis, Nov 2026)

Method: the live site sits behind a Cloudflare bot challenge, which was not bypassed. The Wayback Machine snapshot of `watchcharts.com/watches` (2 Feb 2026) and its first-party bundles (`/js/core.*.js`, `/js/watchcharts-watches-index.*.js`, two React islands) were statically analysed with `rea analyze-javascript-application` (rea-agents 6.8.0). Nothing was executed.

## Stack
- **Server-rendered pages** (CakePHP — the bundle references a CakePHP element `search/suggest_watch_and_variation`), with page-specific JS.
- **jQuery + Bootstrap 5.3.2** (bootstrap-select, datepicker, offcanvas, modals), Font Awesome kit, noUiSlider for range filters.
- **Chart.js** with date adapter, datalabels, annotation, boxplot and downsample plugins for all charts.
- **React islands**: small esbuild bundles (`/react/reactPages/<Name>/main.js`) that `hydrateRoot` onto server HTML (e.g. `.add-to-collection` with `data-initial-state` JSON).
- Third-party libs served from jsDelivr's combine endpoint out of a public GitHub repo (`gh/watchcharts/cdn`).
- Cloudflare in front (bot challenge, analytics beacon), Stripe for subscriptions, reCAPTCHA v3, Google Analytics, Klaviyo.
- Paywalled sections render blurred (`.content-container.paywall .paywall-blur`).

## Search suggestions
- Endpoints such as `/suggest/listings.json?q=`, `/suggest/analytics/<brand_id>.json?q=` and `/suggest/compare.json` return grouped buckets (brands/collections first, then models with images).
- jQuery handles input/focus/blur, aborts the previous request, and highlights the keyboard selection with a `search-result-selected` class.

## Listing scatter chart (the chart on watch pages)
- A Chart.js `type: "scatter"` chart; each point carries the listing object (`unix_timestamp`, price, `is_external`, URL).
- `onClick`: on desktop opens a Bootstrap offcanvas with the listing details and link (`handleListingChartOffcanvas`); on mobile/app it navigates to the listing (`handleListingChartClick`).
- A custom HTML tooltip (`#scatterplot-tooltip`), a `beforeDraw` plugin that shades a fair-price band (lower/upper bound), and a data-source switch remembered in the `listingChartSource` cookie (marketplace vs forum).
- eBay listings are country-specific via an `ebayCountry` cookie (affiliate links).

## What WatchLedger adopted
Grouped, keyboard-navigable suggestions with photos; filters under the search instead of a sidebar; a scatter of listings where each dot links to the listing (SVG, no Chart.js dependency) with a dedicated "For sale now" column; market price shown as a dashed reference line. Not copied: their data, branding, design or paywall model.
