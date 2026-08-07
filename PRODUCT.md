# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single private user (the owner) — a self-hosted personal tool, not multi-tenant. Used for a daily check-in on trading performance.

## Product Purpose

A personal trading dashboard that gives an at-a-glance cockpit view of trading performance on Hyperliquid: current PNL, win rate, open positions, and trade history — reviewed daily. Success is a fast, confident read of "how am I doing right now."

## Positioning

Trades are executed exclusively on Hyperliquid (a decentralized perps exchange) and are pulled in automatically via the Hyperliquid public Info API — no manual trade entry. The dashboard is a read-only mirror of on-chain fill history, reconstructed into round-trip trades.

## Operating Context

- Data source: Hyperliquid Info API (`https://api.hyperliquid.xyz/info`), fetched server-side and synced into a self-hosted Appwrite instance for persistence and fast reads.
- A single wallet address (configured via server env var) is tracked.
- Sync is manually triggered ("Sync now") from the dashboard; there is no background scheduler yet.
- Access is gated by a simple password/cookie login (existing `/login` flow) — private single-user tool, not public.

## Capabilities and Constraints

- Read-only: no manual trade creation/editing. All trade data derives from reconstructed Hyperliquid fills (entry/exit price, size, PNL, fees, open/closed status).
- Stop-loss/take-profit/RRR are not available from Hyperliquid fill data (no manual journal fields anymore) — undecided whether/how to reintroduce discretionary notes per trade in the future.
- Self-hosted Appwrite instance (not Appwrite Cloud) — server API calls only, using a server API key; no public Appwrite client writes.

## Brand Commitments

No branding constraints — plain "Trading Dashboard" naming is fine. No logo/asset requirements.

## Evidence on Hand

No real trade data reviewed yet (wallet not yet synced at time of writing). No existing brand assets beyond the current generic dark-slate Tailwind UI, which is being fully replaced.

## Product Principles

- Performance readability first: the daily-glance stats (PNL, win rate, open positions) must be immediately legible before any detail view.
- Read-only trust: never imply the dashboard can edit or place trades — it mirrors Hyperliquid truth.
- Confident trading-terminal tone: dense, precise, numerical — not a consumer dashboard.
- Private tool: no onboarding/marketing framing; optimize for the owner's repeated daily use.
