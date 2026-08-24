---
name: Trading Dashboard
description: A Liquid Glass portfolio and trading dashboard — frosted, translucent instrument cards floating over a drifting ambient color field.
colors:
  ink-950: "#050609"
  ink-900: "#0a0c11"
  ink-850: "#0f121a"
  ink-800: "#151a23"
  ink-700: "#1d2330"
  ink-600: "#2a3242"
  ink-500: "#5c6577"
  ink-400: "#8891a3"
  ink-300: "#aeb6c4"
  ink-100: "#f2f4f8"
  signal: "#0a84ff"
  signal-dim: "#0060df"
  up: "#32d74b"
  up-dim: "#1fa834"
  down: "#ff453a"
  down-dim: "#d92e24"
  amber: "#ff9f0a"
  amber-dim: "#c97800"
typography:
  ui:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
rounded:
  sm: "16px"
  md: "20px"
  lg: "28px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  panel:
    backgroundColor: "rgba(255,255,255,0.06)"
    border: "1px solid rgba(255,255,255,0.10)"
    backdropBlur: "40px"
    rounded: "{rounded.lg}"
  button-primary:
    backgroundColor: "rgba(10,132,255,0.15)"
    textColor: "{colors.signal}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "rgba(10,132,255,0.25)"
  input:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.ink-100}"
    rounded: "{rounded.md}"
---

# Design System: Trading Dashboard

## Overview

**Creative North Star: "Liquid Glass"**

A private, single-user cockpit for reading portfolio and Hyperliquid performance, rendered as frosted, translucent instrument cards floating over a slow-drifting ambient color field — the Apple visionOS/iOS "Liquid Glass" material register. This replaces the former "Instrument Panel" identity outright at the user's explicit request: the flat graphite terminal, hairline borders, and monospace-heavy Bloomberg/dYdX register are fully retired, not softened. Every panel, button, chip, and input now shares one frosted-glass material — translucent white fill, `backdrop-blur`, a soft white hairline border, an inner sheen, and a diffuse drop shadow — instead of a flat bordered rectangle on solid black.

Density and legibility still outrank decoration — this is an Operate surface, not a marketing page — but the material itself now carries warmth and depth that the old flat instrument-panel language deliberately refused. Numbers still flash briefly on live update, unchanged from before; the change is entirely in what a "panel" is made of.

**Key Characteristics:**
- Frosted glass panels: translucent white fill (`bg-white/6%`), `backdrop-blur-2xl`, hairline white border, inner top sheen, soft outer shadow — no flat, opaque surfaces anywhere
- A fixed ambient background of three large, slowly drifting blurred color fields (signal blue, up green, amber) behind everything — the material glass panels are meant to refract
- Fully rounded pill shapes for every button, filter, and status chip; large `20–28px` radii on panels — no small "instrument" corners
- One consistent sans typeface (Inter) throughout; no monospace face — numeric columns keep `tabular-nums` for alignment without switching families
- Apple system-palette accents: signal blue, up green, down red, amber — chosen to stay saturated and legible seen through frosted glass

## Colors

Neutral graphite base and ambient color fields; accent color is spent on meaning and on the background atmosphere itself.

### Primary
- **Signal Blue** (`#0a84ff`): the primary accent — sync button, focus rings, active/open-status chips, ambient background field. Apple's system blue, chosen for how it reads through blur.

### Neutral
- **Void** (`#050609`, `ink-950`): base page background beneath the ambient gradient.
- **Panel glass**: not a solid color — `rgba(255,255,255,0.06)` fill over `backdrop-blur-2xl`, so panels always show a hint of the ambient field behind them.
- **Hairline** (`rgba(255,255,255,0.10–0.12)`): the border on every glass panel, pill, and input — a soft white line, not a graphite one, since the surface is translucent.
- **Muted Text** (`#8891a3`, `ink-400`): labels, secondary table values.
- **Primary Text** (`#f2f4f8`, `ink-100`): coin symbols, balances, primary readouts.

### Semantic
- **Up** (`#32d74b`): positive PNL, long side.
- **Down** (`#ff453a`): negative PNL, short side, error states.
- **Amber** (`#ff9f0a`): win rate / profit factor readouts — a third semantic tone reserved for "quality of performance" metrics, distinct from raw PNL direction.

### Named Rules
**The Glass-Only Surface Rule.** Every container — panel, card, button, input, chip — is a frosted-glass surface (translucent fill + blur + hairline border), never a flat opaque fill. A flat solid-color box is a regression to the retired terminal language.

## Typography

**Font:** Inter (with system-ui fallback) — the only typeface in the system.

**Character:** Inter throughout, at normal weight for body/labels and semibold for primary readouts and headings. The former all-monospace treatment is gone; only numeric table columns and stat readouts keep `tabular-nums` so digits still align in columns, without pulling in a separate monospace face to do it.

### Hierarchy
- **Instrument value** (semibold, `text-3xl`/`text-4xl`, `tabular`): the stat-module readouts (PNL, win rate, position counts, equity figures).
- **Body/table** (regular, `text-sm`, `tabular` for numeric columns): trade table cells, filter controls.
- **Label** (regular, `text-[10px]`–`text-xs`, `tracking-widest`, uppercase): stat-module captions and table headers.

## Layout

Single-column, max-width 6xl (1152px), centered, 12–16px gaps between modules. The account-value row and instrument rows sit above the equity curve, filters, and trade table in the same reading order as before. Density stays constant across breakpoints.

## Elevation & Depth

Depth is now real, not simulated by a border alone. Every panel sits above the ambient background with a soft outer shadow, a `backdrop-blur` that visibly reveals the drifting color fields, and an inset top-edge sheen (`inset 0 1px rgba(255,255,255,0.14)`) that reads as a glass edge catching light.

### Named Rules
**The Ambient-Behind-Glass Rule.** A glass panel only reads as glass when something with color and shape sits behind it. The `Background` component's three drifting blurred fields are mounted once, fixed, behind every page — never remove or flatten it, or every panel above it goes back to looking like a plain translucent gray box.

## Shapes

Large, soft radii throughout: `28px` on panels, `20px` on inputs, full pill (`999px`) on every button, filter control, and status chip. Corners are now a material property of the glass, not a quiet structural detail — softness is the point.

## Components

### Buttons / Pills
- **Shape:** full pill (`rounded-full`), glass fill, hairline white border.
- **Primary (Sync now, form submit):** `signal`-tinted glass — `bg-signal/15`, `border-signal/30`, `text-signal`.
- **Neutral:** plain glass — `bg-white/7%`, `border-white/12%`, `text-ink-100`.
- **Destructive:** `down`-tinted glass, same pill shape.
- **Hover:** fill opacity steps up; no transform, no shape change.
- **Disabled:** 50% opacity, cursor blocked.

### Stat Modules
- **Shape:** `glass-panel`, `28px` radius, consistent internal padding.
- **Structure:** a `10px` uppercase muted label above one large tabular `FlipValue` readout.
- **Live update:** value background flashes semantic-tinted for 700ms on change, unchanged behavior from the prior system.

### Trade Table
- **Style:** lives inside one `glass-panel` wrapper; row dividers are `white/6%` hairlines, header row in muted uppercase over a `white/10%` rule.
- **Row hover:** `white/4%` tint — the only per-row feedback.
- **Status chip:** full pill, `signal`-tinted glass for open positions, plain glass for closed.

### Inputs / Selects
- **Style:** `rounded-2xl`, `bg-white/5%`, `border-white/12%` glass fill.
- **Focus:** border shifts to `signal/50%`, fill lightens slightly. No glow, no outline ring.

### Equity Curve
- Bare SVG line-and-area chart, unchanged in structure; the area fill is now a vertical gradient fading from the up/down stroke color to transparent, echoing the glass material's own translucency instead of a flat 10%-opacity fill.

### Forms (Einstellungen)
- **Field:** unchanged pattern — `10px` uppercase muted label stacked above its glass input.
- **Panel:** every form lives inside its own `glass-panel`, opened inline, never a modal.
- **Actions:** cancel (plain glass pill) and submit (`signal`-tinted glass pill) sit bottom-right; destructive actions use `down`-tinted glass pills and always confirm before executing.

## Do's and Don'ts

### Do:
- **Do** give every container the glass treatment: translucent fill, blur, hairline border, soft shadow.
- **Do** keep the ambient `Background` mounted behind every page — it is what the glass blurs against.
- **Do** run every numeric column in `tabular-nums` so digits align, even without a monospace face.
- **Do** use full pill shapes for every button, filter, and chip.

### Don't:
- **Don't** reintroduce a flat, opaque panel fill (`bg-ink-900` solid) — that is the retired terminal language.
- **Don't** use a monospace typeface anywhere; Inter with `tabular-nums` covers every numeric-alignment need.
- **Don't** use small "instrument" corner radii (`2px`/`6px`) — every shape rounds generously now.
- **Don't** let a panel sit without the ambient background behind it; a glass panel over flat black reads as a bug, not a material.
