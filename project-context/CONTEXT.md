# WatchProject — Project Context

_Last updated: 2026-11-08_

## What this project is
**WatchProject** is a **personal watch collection and regional market price data API**
(from the repository README).

Two core concerns:
1. **Personal collection** — track the watches the owner has (model, reference, purchase info, condition, etc.).
2. **Regional market prices** — store and serve market price data for watches, broken down by region/market.

## Current state (as of initial review)
- Repository: `duckbat/WatchProject`, default branch `main`.
- Only one commit ("Initial commit") containing `README.md`.
- **No code, stack, schema or tooling has been chosen yet.** Everything below is open.

## Open decisions (to settle before building)
- [ ] Language / framework for the API (e.g. Python + FastAPI, Node + Express/Fastify, Go, …)
- [ ] Database (e.g. PostgreSQL, SQLite for local/dev)
- [ ] Data model: watches, brands, references, collection entries, regions, price observations
- [ ] Source(s) of regional market price data (manual entry, imports, scraping, third-party APIs)
- [ ] Currency handling / conversion and price history
- [ ] Auth (single-user personal API vs. multi-user)
- [ ] Hosting / deployment

## Working notes
- Development branch for Claude sessions: `claude/adoring-bardeen-8wncz8`.
- Keep this file updated as decisions are made; log notable changes in `DECISIONS.md`.
