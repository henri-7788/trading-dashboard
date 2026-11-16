# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single private user (the owner) — a self-hosted personal tool, not multi-tenant. Used for a daily check-in on trading performance.

## Product Purpose

A personal portfolio dashboard that gives an at-a-glance cockpit view of trading and investing performance across every account the owner uses: current total equity, PNL, win rate, open positions, and holdings — reviewed daily. Success is a fast, confident read of "how am I doing right now," across everything, not just one exchange.

## Positioning

Multi-source by design: Hyperliquid perps/spot and any ccxt-supported crypto exchange (Binance, Coinbase, Kraken, Bybit, OKX, and ~100 others) sync automatically via API connections the owner adds under Einstellungen; stocks, ETFs, and anything without a usable read API are logged manually as buy/sell transactions. The dashboard aggregates all of it — perps trades, exchange balances, and manual positions — into one equity figure and one holdings table.

## Operating Context

- Hyperliquid: public Info API (`https://api.hyperliquid.xyz/info`), no credentials needed beyond the wallet address.
- Other crypto exchanges: the `ccxt` library, authenticated per connection with an API key/secret (read-only keys recommended) entered in Einstellungen. Secrets are AES-256-GCM encrypted (`ENCRYPTION_KEY` env var) before being stored in Appwrite.
- Stocks/ETFs/other: manually entered buy/sell transactions in Einstellungen; valued via Yahoo Finance's public chart endpoint using a plain ticker the owner provides (e.g. `AAPL`, `VWCE.DE`), non-USD quotes converted to USD via Yahoo's FX tickers.
- All connections, trades, holdings, and manual transactions persist in a self-hosted Appwrite instance.
- Sync is manually triggered ("Sync now") from the dashboard and loops over every enabled connection; there is no background scheduler yet.
- Access is gated by a simple password/cookie login (existing `/login` flow) — private single-user tool, not public.

## Capabilities and Constraints

- Perps trades (Hyperliquid) are read-only, reconstructed from fills — no editing.
- Crypto exchange holdings sync from `fetchBalance`; per-exchange trade journal sync requires the owner to list trading pairs per connection (not every ccxt exchange supports scanning all pairs without one specified).
- Manual stock/ETF/other positions are the one editable data source — owner can add and delete entries directly; equity for these is computed from a running weighted-average cost, not a broker feed.
- Stop-loss/take-profit/RRR are not available from any of these sources — undecided whether/how to reintroduce discretionary notes per trade.
- Self-hosted Appwrite instance (not Appwrite Cloud) — server API calls only, using a server API key; no public Appwrite client writes.

## Brand Commitments

No naming/logo constraints — plain "Trading Dashboard" is fine (own candlestick mark, never another product's name or logo). Visual register is a standing preference: **Petrol & paper** — a deep petrol hero band over a cool grey ground with calm near-white cards and petrol data marks, adopted 2026-11-16 from a fintech reference the owner supplied. It replaces **Liquid Glass** (frosted panels over an ambient colour field, 2026-08-24), which itself replaced a dense monospace trading-terminal identity; an even earlier split-flap "departures board" identity was rejected as a gimmick. See DESIGN.md for the current system.

## Evidence on Hand

No real trade data reviewed yet (wallet not yet synced at time of writing). Current UI is documented in DESIGN.md (Petrol & paper redesign, 2026-11-16).

## Product Principles

- Performance readability first: the daily-glance stats (PNL, win rate, open positions) must be immediately legible before any detail view.
- Read-only trust: never imply the dashboard can edit or place trades — it mirrors Hyperliquid truth.
- Warm, modern instrument tone: precise and numerical, but rendered in soft frosted glass rather than a cold, dense terminal — not a consumer dashboard either.
- Private tool: no onboarding/marketing framing; optimize for the owner's repeated daily use.
