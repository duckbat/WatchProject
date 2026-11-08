# WatchProject — WatchLedger

Market data now includes Antiquorum published sold results and selected Christie’s Geneva online catalogues (December 2023 and October 2026), alongside Nordic asking prices, WatchRecon/WatchUSeek sale posts and Phillips when reachable. Auction results enter the existing archived graphs and scheduled refresh. Estimates, bids and multi-watch bundles are excluded; sold-marked forum prices remain last asks. See `MARKETPLACES.md` for coverage limits and sources that are not connected.

WatchLedger is a private website for discovering watch models, tracking a personal collection, and comparing prices across global and local marketplaces.

[Open the website](https://watchledger-khai.breezydragonfly1.chatgpt.site)

## Purpose

The goal is to help collectors understand the market for the watches they own or want to follow. Instead of checking several marketplaces separately, users can keep price observations, compare regions, and build a price history in one place.

The website is for research and personal tracking. It has no listings for sale, checkout, or payment features.

## What users can do

- Search by watch model or reference from a search-first home page with live suggestions (brands and references with photos, keyboard navigation, recent searches).
- Filter by brand, region, currency, price type and statistic directly under the search field.
- Open a watch to see its market price from live exact-reference listings, a price range, and a chart where every dot is a listing you can click through to.
- Bookmark live listings to build your own dated price history.
- Reach My watches, Price records, Sources and data export from the profile menu (top right).
- Browse a catalog of 40,757 entries across 224 brands and filter results by brand.
- Add owned watches with purchase dates and prices, or add a missing reference.
- Compare recorded asking prices and confirmed sale prices using averages or medians.
- Filter market observations by region, country, source, currency, condition, seller type, and date range.
- Compare the EU, US, Asia, and individual supported countries. Regions follow seller location, independently of currency.
- View dated price history and export personal records as JSON.
- Save local sources such as Tori.fi, a local dealer, or a Facebook watch group.

## Market data

WatchLedger has its own API for catalog searches, personal records, marketplace collection, and regional price summaries.

| Source | Current support |
| --- | --- |
| Phillips | Automatic public auction results: verifies brand/reference on lot pages, imports reported sale amounts and auction end dates. Up to eight sold lots from the first search page. |
| Tori.fi, FINN.no, Blocket, DBA | Live asking prices from Finland, Norway, Sweden and Denmark (one shared classifieds platform). Listings naming only the base reference count as "same reference", labelled, unless they name a different dial. |
| WatchRecon | Sale posts indexed from watch forums (mostly r/Watchexchange, r/Watch_Swap, TimeZone), with price and post date. |
| eBay | Browse API adapter for active listings; requires server-side application credentials and an **enabled** production keyset (see MARKETPLACES.md: Marketplace Account Deletion endpoint at `/api/ebay/account-deletion`, `npm run ebay:check`). |
| Chrono24 | Bot challenge on automated requests (not bypassed). Watch pages link to Chrono24's search; save listings with the **Save to WatchLedger** button or record them manually. Prices are shown with Chrono24's 6.95% commission: buyer price and seller net. |
| Reddit r/Watchexchange | Reddit's public RSS is blocked/retired (Nov 2026) and new API keys are closed; posts arrive through WatchRecon. Existing API keys still work until March 2027. |
| Kellofoorumi, Klocksnack, Tidssonen | Finnish, Swedish and Norwegian watch-forum sale sections (public RSS, archived). Prices read in the local currency; sold and wanted posts recognised. |
| Auctionet | Sold lots from Nordic, UK and EU auction houses via Auctionet's public item API; winning bid (buyer's premium excluded) and closing date. |
| WatchUSeek | Sale-forum RSS feed archived as it is read; threads naming a reference with a price in the title or preview are used. |
| Facebook groups | No API exists; use the **Save to WatchLedger** browser button on a post. |
| Any website | **Save to WatchLedger** browser button: reads the listing you are viewing (structured price data or selected text) and adds it to your history. |
| Custom marketplaces | Save a source name and link, then record observations manually. Adding a link does not create a scraper. |

Search ranks watches with the most priced market observations first among equally close matches (an exact reference always stays on top), shows the count on results and suggestions, and the home page lists the **most tracked watches**. `node scripts/seed-popular.mjs [base URL]` collects data for ~40 widely traded references to start that list.

Collection runs when a watch is opened; a protected refresh endpoint also supports unattended updates. Marketplace listings are retained automatically in D1; missing listings keep their last observed status rather than being marked sold. Price history also includes saved observations; historical market data is not preloaded. Asking prices, confirmed sales, and the last asking price of a sold watch are kept distinct. Different currencies are never combined or automatically converted.

## Catalog and photos

Reference metadata comes from the [Timepiecepedia CC0 dataset](https://github.com/timepiecepedia/timepiecepedia-data), normalized and deduplicated, with existing application references retained. Coverage is broad but incomplete, and specifications have not all been independently verified. The catalog itself supplies no market prices.

Original photo URLs were recovered for 39,883 catalog references. Missing or unavailable images show a plain watch icon. Photos are externally hosted; their availability and usage rights are separate from the catalog metadata license. Sources are credited in the interface.

## Technical overview

- React and Vinext frontend, hosted as a private Cloudflare Worker through Sites.
- Cloudflare D1 and Drizzle for authenticated, user-owned records.
- Server-side catalog search and pagination, so the full catalog is not downloaded into browser JavaScript.
- Bounded marketplace requests, request-rate limits, and duplicate-observation checks.

See [DATA-SOURCES-RESEARCH.md](DATA-SOURCES-RESEARCH.md) for the per-platform data access research and price-accuracy audit, [MARKETPLACES.md](MARKETPLACES.md) to connect eBay and set up the save button, and [API.md](API.md) for endpoints, collector setup, supported currencies, and limitations. See [data/catalog/README.md](data/catalog/README.md) for catalog provenance and [PROJECT-NOTES.md](PROJECT-NOTES.md) for implementation notes.

## Framework and hosting reference

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` defines user-owned tracker records
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

Automatic exact matches require the complete catalog reference, including a variant suffix such as `126200-0001`. Base-reference-only results and conflicting explicit dial descriptions are classified as similar/unverified, excluded from market prices and hidden from the graph unless enabled. Older automatic archives are reclassified on read; observations are retained.
