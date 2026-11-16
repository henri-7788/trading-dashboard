---
name: Trading Dashboard
description: Petrol & paper — a deep petrol hero band over a cool grey ground, with calm near-white cards and petrol data marks.
colors:
  page: "#edf0f0"
  ink-50: "#f7f9f9"
  ink-100: "#eef1f2"
  ink-150: "#e6eaeb"
  ink-200: "#dde3e5"
  ink-300: "#c4cdd0"
  ink-400: "#94a2a7"
  ink-500: "#6b7a80"
  ink-600: "#4c5c62"
  ink-700: "#33434a"
  ink-800: "#1f2f36"
  ink-900: "#10212a"
  ink-950: "#08161c"
  teal-50: "#eff6f7"
  teal-100: "#dceaee"
  teal-200: "#bcd6de"
  teal-300: "#8fb9c6"
  teal-400: "#5e97a9"
  teal-500: "#3b7b90"
  teal-600: "#266579"
  teal-700: "#1a5366"
  teal-800: "#134456"
  teal-900: "#0d3646"
  teal-950: "#082733"
  up: "#1d8556"
  up-soft: "#e3f3ea"
  down: "#c4463c"
  down-soft: "#fbe9e7"
  amber: "#b4740f"
  amber-soft: "#fbf0dc"
typography:
  ui:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  display:
    fontFamily: "Geist"
    fontWeight: 400
    letterSpacing: "-0.035em"
rounded:
  row: "18px"
  card: "24px"
  pill: "999px"
spacing:
  gap-mobile: "12px"
  gap-desktop: "16px"
  card-padding: "16px–24px"
components:
  card:
    backgroundColor: "{colors.ink-50}"
    border: "1px solid #ffffff"
    rounded: "{rounded.card}"
    shadow: "0 1px 2px rgba(16,33,42,.04), 0 8px 24px -12px rgba(16,33,42,.10)"
  card-row:
    backgroundColor: "#ffffff"
    border: "1px solid {colors.ink-100}"
    rounded: "{rounded.row}"
  pill:
    backgroundColor: "#ffffff"
    border: "1px solid {colors.ink-150}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.pill}"
  pill-primary:
    backgroundColor: "{colors.teal-800}"
    textColor: "#ffffff"
  pill-on-dark:
    backgroundColor: "rgba(255,255,255,0.06)"
    border: "1px solid rgba(255,255,255,0.25)"
    textColor: "#ffffff"
  pill-on-dark-solid:
    backgroundColor: "#ffffff"
    textColor: "{colors.teal-900}"
---

# Design System: Trading Dashboard

## Overview

**Creative North Star: "Petrol & paper"**

A private, single-user cockpit for portfolio and trading performance. The top of every page is a deep petrol band (dark `#0d3646` easing to `#5e97a9`, fading into the grey ground) with a fine white dot screen over it, so the colour reads as printed material. The band carries the brand, section navigation, a large greeting, and the day's actions. Everything below is calm: near-white cards on a cool grey page, with white inset rows inside them.

Colour is spent in exactly three places: the band, the single **insight card** (same petrol material, or brick red when a position nears liquidation), and the data marks themselves. Green and brick red mean PnL direction and nothing else.

Adopted 2026-11-16 at the owner's request from a supplied fintech reference (petrol hero, white cards, dot-matrix / segment / hatched-bar charts). It replaces the Liquid Glass identity outright.

**Key characteristics**
- One saturated band, everything else quiet. No translucent glass, no ambient blobs.
- Large figures in Geist at *regular* weight with tight tracking. Weight never carries emphasis on numbers; size and colour do.
- Capsule pills for every control. On the band they are a white hairline ghost or solid white.
- Charts are drawn from petrol dots, slim segments, and bars, never thick strokes or neon.

## Colors

- **Page** `#edf0f0`: the ground below the band.
- **Card** `ink-50` with a white 1px border and a soft two-layer shadow. **Row** pure white with an `ink-100` border, used for list entries inside cards.
- **Text**: `ink-900` primary, `ink-500` secondary, `ink-400` tertiary and axis labels. On the band: white, `white/75` for body, `white/70` for meta.
- **Petrol** `teal-*`: primary actions (`teal-800`), chart marks (`teal-800` strong, `teal-300` soft, `teal-100` pale bars), icon chips.
- **Up / Down** `#1d8556` / `#c4463c` with soft tints `up-soft` / `down-soft` for side badges and pale bars.
- **Amber** only for the "caution" liquidation tier.

## Typography

Geist (via `next/font/google`, variable `--font-ui`) throughout. Display greeting at 32px mobile / 44px desktop, weight 400, tracking −0.035em. Card titles at 15px medium. Key figures use `FlipValue` (`xl` 36/44px, `lg` 26/30px), weight 400, tracking −0.02em, `tabular-nums`. Small meta at 11–13px. No monospace.

## Layout

Max width 1240px. Band → greeting row → a three-card first row (net worth with equity curve · PnL-per-trade dot matrix · insight card) → a three-column second row (allocation · trades · monthly performance + key figures). Below `lg` everything stacks into one column in that order. Phones keep 44px touch targets, 16px form text, safe-area padding, and a bottom-sheet trade detail.

## Elevation & Depth

Flat, quiet elevation: cards use `shadow-card`. The insight card and dark tooltip pills use `shadow-float`. Nothing glows.

## Shapes

Cards 24px, rows and inputs 18px, every control a full capsule. Icon chips are 44px rounded squares (16px radius) in white.

## Components

- `.card`, `.card-tight`, `.card-row`, `.pill`, `.pill-primary`, `.pill-danger`, `.pill-on-dark`, `.pill-on-dark-solid`, `.field`: in `styles/globals.css` inside `@layer components`, so utilities on an element always override them.
- `.hero-band` (rendered by `components/Background.tsx`, absolute at the top of the document) and `.insight-surface` / `.insight-surface.is-warning`.
- `PillSelect`: a native `<select>` dressed as a capsule, so phones keep their own picker.
- Charts in `components/Charts.tsx`: `TradeDotMatrix` (wins stack petrol dots up from a centre line, losses brick red down, the top dot solid), `MonthlyBars` (six months, pale bars, the selected month hatched with a dark label pill, empty months a dash on the zero line), `SegmentMeter` (14 slim segments for portfolio share). `components/EquityCurve.tsx` draws a smoothed petrol curve with an HTML end dot.
- Trade detail: a centred card on desktop and a bottom sheet on phones, grouped into Position / Preise / Ergebnis rows.

## Do's and Don'ts

- **Do** keep colour to the band, the insight card, and data marks. **Don't** tint cards or add accent borders.
- **Do** show numbers at regular weight. **Don't** bold figures for emphasis.
- **Do** keep every money value behind the `usd()` / `qty()` masks so the eye toggle hides it, chart axes included.
- **Don't** reintroduce glass blur, ambient blobs, or a dark page. That identity was retired on 2026-11-16.
