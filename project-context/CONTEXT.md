# WatchProject — Project Context

_Last updated: 2026-11-09_

## What this project is
**WatchProject** is a **personal watch collection and regional market price data API**
(from the repository README).

Two core concerns:
1. **Personal collection** — track the watches the owner has (model, reference, purchase info, condition, etc.).
2. **Regional market prices** — store and serve market price data for watches, broken down by region/market.

## Current state
- The app is built: **WatchLedger**, a React 19 + vinext site running as a Cloudflare Worker with D1 (Drizzle). See `README.md`, `AGENTS.md` and `PROJECT_CONTEXT.md` for the verified architecture.
- Prices are collected automatically from Nordic classifieds (Tori, FINN, Blocket, DBA), eBay (Browse API), sale forums (WatchRecon, WatchUSeek, Kellofoorumi, Klocksnack, Tidssonen), Finnish shops and auction results (Auctionet, Antiquorum, Christie's, Phillips). Coverage and limits: `MARKETPLACES.md`, `DATA-SOURCES-RESEARCH.md`.
- Personal records (collection, favourites, saved prices) are per signed-in user.
- The decisions below were settled by that implementation; they are kept for history.

## Decisions settled by the implementation (originally open)
- [x] Language / framework for the API (e.g. Python + FastAPI, Node + Express/Fastify, Go, …)
- [x] Database (e.g. PostgreSQL, SQLite for local/dev)
- [x] Data model: watches, brands, references, collection entries, regions, price observations
- [x] Source(s) of regional market price data (manual entry, imports, scraping, third-party APIs)
- [x] Currency handling / conversion and price history
- [x] Auth (single-user personal API vs. multi-user)
- [x] Hosting / deployment

## Working notes
- Development branch for Claude sessions: `claude/adoring-bardeen-8wncz8`.
- Keep this file updated as decisions are made; log notable changes in `DECISIONS.md`.
