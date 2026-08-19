---
name: Trading Dashboard
description: A dense, flat, monospace trading terminal for daily PNL review on Hyperliquid.
colors:
  ink-950: "#08090b"
  ink-900: "#0c0d10"
  ink-850: "#111318"
  ink-800: "#16181d"
  ink-700: "#1e2127"
  ink-600: "#282c33"
  ink-500: "#5b6270"
  ink-400: "#828a99"
  ink-300: "#a8afb9"
  ink-100: "#e7e9ed"
  signal: "#4f8cff"
  signal-dim: "#2f5bb0"
  up: "#3fb37f"
  up-dim: "#1f7a54"
  down: "#d9564b"
  down-dim: "#8f3a33"
typography:
  ui:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "2px"
  md: "6px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  panel:
    backgroundColor: "{colors.ink-950}"
    rounded: "{rounded.md}"
  button-primary:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.signal}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-800}"
  input:
    backgroundColor: "{colors.ink-900}"
    textColor: "{colors.ink-100}"
    rounded: "{rounded.sm}"
---

# Design System: Trading Dashboard

## Overview

**Creative North Star: "The Instrument Panel"**

A private, single-user cockpit for reading Hyperliquid performance in seconds, built in the register of a professional trading terminal — dYdX, Hyperliquid's own app, Bloomberg Terminal — rather than a themed novelty. The system was redesigned away from an earlier split-flap "departures board" identity (flap tiles, rivets, an embossed physical-board metaphor): that identity read as a gimmick rather than a serious instrument, and every trace of it (tile bevels, flip animation, amber/bone palette, grain texture) has been removed. What replaced it is deliberately unglamorous: flat graphite panels, hairline borders, tabular monospace figures, and one restrained accent used only for interactive and "live" signal.

Density and legibility outrank decoration. The owner opens the dashboard once or twice a day, needs PNL, win rate, and open positions to register instantly, and everything else is secondary. Numbers still move — a value briefly flashes green, red, or blue on live update, the terminal equivalent of a ticker tick — but nothing on the page performs; the only motion is functional feedback.

**Key Characteristics:**
- Flat, near-black graphite surfaces with no shadows, gloss, or embossing
- Hairline 1px borders as the sole structural device — no cards-on-cards
- All numeric and most UI text set in tabular monospace; one restrained cool-blue accent for interactivity
- Semantic green/red reserved strictly for PNL and long/short — never decorative
- A brief background flash marks a live value update instead of a physical animation

## Colors

Almost entirely neutral graphite; color is spent only on meaning.

### Primary
- **Signal Blue** (`#4f8cff`): the only non-semantic accent. Used for the sync button, focus rings, active/open-status chips, and the win-rate readout. Nowhere else — its rarity is what makes it read as "live."

### Neutral
- **Void** (`#08090b`, `ink-950`): page background. The only background color in the system; panels do not get a lighter fill, only a border.
- **Graphite** (`#0c0d10`–`#16181d`, `ink-900`/`ink-850`/`ink-800`): interactive-element fills only — buttons, inputs, select boxes, hover states on table rows. Never used as a panel or card background.
- **Hairline** (`#1e2127`, `ink-700`): the standard panel and table border.
- **Hairline Dim** (`#282c33`, `ink-600`): border on inputs/buttons/selects, one step brighter than a panel border to read as interactive.
- **Muted Text** (`#828a99`, `ink-400`): labels, secondary table values (entry/exit/size/duration/timestamps). Chosen to clear 4.5:1 contrast against `ink-950` — the earlier darker gray failed body-text contrast and was rejected during finishing review.
- **Primary Text** (`#e7e9ed`, `ink-100`): coin symbols, account balances, and any value that must read as the record, not context.

### Semantic
- **Up** (`#3fb37f`): positive PNL, long side. Never used decoratively.
- **Down** (`#d9564b`): negative PNL, short side, and error states.

### Named Rules
**The Meaning-Only Color Rule.** Signal blue, up-green, and down-red are the only colors permitted outside the neutral graphite scale. If a new element needs color and isn't interactive (blue), a live-value tick (blue), or a PNL/side value (green/red), it stays neutral.

## Typography

**UI Font:** Inter (with system-ui fallback)
**Data Font:** JetBrains Mono (with ui-monospace fallback)

**Character:** The interface renders almost entirely in JetBrains Mono — labels, buttons, headers, and table cells alike — the console-register choice a data terminal earns natively; Inter is loaded as the UI face for any future prose-heavy surface (e.g. settings copy) but does not yet appear on a live screen. Every number is `tabular-nums`, so columns of prices and durations align on their digits regardless of value.

### Hierarchy
- **Instrument value** (500 weight, `text-3xl`/`text-4xl`, `tabular`): the four stat-module readouts (PNL, win rate, position counts) and the two equity figures. The largest text on the page.
- **Body/table** (400 weight, `text-sm`, `tabular` for numeric columns): trade table cells, filter controls.
- **Label** (400 weight, `text-[10px]`–`text-xs`, `tracking-widest`, uppercase): every stat-module caption and table header. Never used above a heading as a kicker — these are literal instrument labels, not decoration.

## Layout

Single-column, max-width 6xl (1152px), centered, with consistent 12–16px gaps between modules. The account-value row (2-up) and instrument row (2-up mobile / 4-up desktop) sit above the equity curve, filters, and trade table in that fixed reading order. Density stays constant across breakpoints; nothing collapses into a card carousel on mobile, only the grid columns reflow.

## Elevation & Depth

Flat by design. There is no shadow vocabulary — every module is delineated by a single `1px` `ink-700` border against the shared `ink-950` background, never by a lighter fill or a shadow. Depth is not simulated; a panel is legible because of its border, not because it appears to float.

### Named Rules
**The No-Fill Panel Rule.** A panel never gets a background color of its own — only a border. A filled panel on `ink-950` would be the first step back toward the tile/gloss language this redesign removed.

## Shapes

Small, consistent radii: `6px` on panels and containers, `2px` on buttons, inputs, selects, and status chips. Corners are a quiet structural detail, not a material — nothing rounds enough to read as soft or friendly.

## Components

### Buttons
- **Shape:** `2px` radius, hairline `ink-600` border.
- **Primary (Sync now):** `ink-900` fill, `signal` text, uppercase, `tracking-widest`, mono.
- **Hover:** fill steps to `ink-800`, border tints toward `signal/50`. No transform, no shadow.
- **Disabled:** 50% opacity, cursor blocked — the only state treatment beyond color.

### Stat Modules
- **Shape:** hairline-bordered panel, no fill, `6px` radius, consistent internal padding.
- **Structure:** a `10px` uppercase muted label above one large tabular `FlipValue` readout.
- **Live update:** the value's background flashes semantic-tinted (green/red/blue depending on tone) for 700ms on change, then fades to transparent — replaces the old physical flip animation.

### Trade Table
- **Style:** hairline row dividers (`ink-800`), header row in muted uppercase labels over an `ink-700` rule.
- **Row hover:** `ink-900` tint at 60% opacity — the only per-row feedback.
- **Status chip:** `2px` radius, `signal`-tinted for open positions, neutral `ink-700` for closed.

### Inputs / Selects
- **Style:** `ink-900` fill, `ink-600` border, `2px` radius, mono text.
- **Focus:** border shifts to `signal/60`. No glow, no outline ring.

### Equity Curve
- **Signature component.** A bare SVG line-and-area chart, no axes or gridlines beyond a single dashed zero-line, stroked in `up` or `down` depending on the cumulative sign. No dots, no tooltip chrome yet — reads as a trace, not a chart widget.

### Forms (Einstellungen)
- **Field:** a `10px` uppercase muted label stacked above its input, `1.5` gap — never inline label-left, which would break the table-like scan pattern the rest of the system uses.
- **Panel:** every form lives inside its own hairline-bordered panel, opened inline below the button that triggered it, never a modal — settings are a task, not an interruption.
- **Actions:** cancel (neutral border) and submit (`signal`-tinted border + fill) sit bottom-right as a pair; destructive actions (remove connection, delete position) use `down`-tinted text on a neutral border instead, and always confirm before executing.

## Do's and Don'ts

### Do:
- **Do** keep every panel borderless-filled — `ink-950` background, `ink-700` border, nothing else.
- **Do** reserve `signal` blue strictly for interactive and live-update elements.
- **Do** run every numeric column in `tabular-nums` monospace so digits align.
- **Do** use the flash-on-change pattern for any future live-updating readout instead of introducing a new motion device.

### Don't:
- **Don't** reintroduce physical/embossed treatments (tile bevels, inset shadows, gradient split panels, rivets) — that identity was deliberately retired, not a lookbook to revisit.
- **Don't** add a shadow anywhere; depth in this system comes from borders only.
- **Don't** use amber, bone, or any warm accent — the palette is cool graphite plus signal blue only.
- **Don't** use `ink-500`/`ink-600` for body text; they read below 4.5:1 on `ink-950` and exist for borders and dividers only.
