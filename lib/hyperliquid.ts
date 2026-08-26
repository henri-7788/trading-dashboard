const HL_INFO_URL = 'https://api.hyperliquid.xyz/info'

export interface HyperliquidFill {
  coin: string
  px: string
  sz: string
  side: 'B' | 'A'
  time: number
  startPosition: string
  dir: string
  closedPnl: string
  hash: string
  oid: number
  fee: string
  tid: number
}

export interface Trade {
  externalId: string
  wallet: string
  coin: string
  side: 'long' | 'short'
  status: 'open' | 'closed'
  entryPrice: number
  exitPrice: number | null
  size: number
  notional: number
  pnl: number
  fee: number
  fillsCount: number
  openedAt: string
  closedAt: string | null
  /** Current leverage setting for this coin's position; only known for still-open trades. */
  leverage: number | null
}

/** Fetches current mid prices for all coins, keyed by coin symbol. Pass `dex` for a builder-deployed perp dex (HIP-3); omit for the main dex. */
export async function fetchMids(dex?: string): Promise<Record<string, string>> {
  return hlInfo(dex ? { type: 'allMids', dex } : { type: 'allMids' })
}

export interface PerpDex {
  name: string
  fullName: string
  deployer: string
}

/** Lists builder-deployed perp dexes (HIP-3) available on top of the main dex. */
export async function fetchPerpDexs(): Promise<PerpDex[]> {
  const dexs: (PerpDex | null)[] = await hlInfo({ type: 'perpDexs' })
  return dexs.filter((d): d is PerpDex => d !== null)
}

/** Fetches mid prices across the main dex and every builder-deployed perp dex, merged into one coin -> price map. */
export async function fetchAllDexMids(): Promise<Record<string, string>> {
  const dexs = await fetchPerpDexs()
  const perDex = await Promise.all([fetchMids(), ...dexs.map((d) => fetchMids(d.name))])
  return Object.assign({}, ...perDex)
}

export interface ClearinghouseState {
  marginSummary: { accountValue: string; totalNtlPos: string; totalRawUsd: string; totalMarginUsed: string }
  withdrawable: string
  assetPositions: Array<{ position: { coin: string; leverage: { type: 'cross' | 'isolated'; value: number } } }>
}

/** Fetches perps account equity/margin summary (accountValue = perps cash + unrealized PnL of open positions). Pass `dex` for a builder-deployed perp dex (HIP-3); omit for the main dex. */
export async function fetchClearinghouseState(wallet: string, dex?: string): Promise<ClearinghouseState> {
  return hlInfo(dex ? { type: 'clearinghouseState', user: wallet, dex } : { type: 'clearinghouseState', user: wallet })
}

/** Fetches perps positions across the main dex and every builder-deployed perp dex, merged into one coin -> leverage map. */
export async function fetchAllDexLeverage(wallet: string): Promise<Map<string, number>> {
  const dexs = await fetchPerpDexs()
  const states = await Promise.all([fetchClearinghouseState(wallet), ...dexs.map((d) => fetchClearinghouseState(wallet, d.name))])
  const leverageByCoin = new Map<string, number>()
  for (const state of states) {
    for (const p of state.assetPositions) leverageByCoin.set(p.position.coin, p.position.leverage.value)
  }
  return leverageByCoin
}

export interface SpotBalance {
  coin: string
  total: string
  hold: string
}

/** Fetches spot wallet balances (separate from the perps margin account). */
export async function fetchSpotClearinghouseState(wallet: string): Promise<{ balances: SpotBalance[] }> {
  return hlInfo({ type: 'spotClearinghouseState', user: wallet })
}

async function hlInfo(body: Record<string, unknown>) {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Hyperliquid API error ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Fetches the full fill history for a wallet, paginating forward in time. */
export async function fetchAllFills(wallet: string, sinceMs = 0): Promise<HyperliquidFill[]> {
  const all: HyperliquidFill[] = []
  let startTime = sinceMs
  const seen = new Set<number>()

  for (;;) {
    const batch: HyperliquidFill[] = await hlInfo({
      type: 'userFillsByTime',
      user: wallet,
      startTime,
      aggregateByTime: false
    })

    const fresh = batch.filter((f) => !seen.has(f.tid))
    if (fresh.length === 0) break
    fresh.forEach((f) => seen.add(f.tid))
    all.push(...fresh)

    if (batch.length < 2000) break
    startTime = Math.max(...batch.map((f) => f.time))
  }

  return all.sort((a, b) => a.time - b.time)
}

/**
 * Reconstructs round-trip trades from a chronological fill history by tracking
 * the running signed position per coin (Hyperliquid only exposes individual fills).
 */
export function buildTradesFromFills(fills: HyperliquidFill[], wallet: string): Trade[] {
  const trades: Trade[] = []
  const positions = new Map<
    string,
    {
      signedSize: number
      side: 'long' | 'short'
      openedAt: number
      entryCost: number // sum(px * sz) for opening fills
      entrySize: number
      exitCost: number
      exitSize: number
      pnl: number
      fee: number
      fillsCount: number
    }
  >()

  // Floating-point sums of many small fills rarely land on exactly 0, so treat anything
  // below this threshold as flat rather than leaving a dust-sized "ghost" open position.
  const EPS = 1e-8
  const sign = (n: number) => (n > EPS ? 1 : n < -EPS ? -1 : 0)

  for (const fill of fills) {
    const coin = fill.coin
    const px = parseFloat(fill.px)
    const sz = parseFloat(fill.sz)
    const fee = parseFloat(fill.fee) || 0
    const closedPnl = parseFloat(fill.closedPnl) || 0
    const delta = fill.side === 'B' ? sz : -sz

    let pos = positions.get(coin)
    const prevSigned = pos ? pos.signedSize : 0
    const newSigned = prevSigned + delta

    if (!pos) {
      pos = {
        signedSize: 0,
        side: delta > 0 ? 'long' : 'short',
        openedAt: fill.time,
        entryCost: 0,
        entrySize: 0,
        exitCost: 0,
        exitSize: 0,
        pnl: 0,
        fee: 0,
        fillsCount: 0
      }
      positions.set(coin, pos)
    }

    pos.fillsCount += 1

    const crossesZero = sign(prevSigned) !== 0 && sign(newSigned) !== sign(prevSigned) && sign(newSigned) !== 0

    if (crossesZero) {
      const closingSize = Math.abs(prevSigned)
      const openingSize = Math.abs(newSigned)
      const totalSize = closingSize + openingSize
      const feeForClose = fee * (closingSize / totalSize)
      const feeForOpen = fee - feeForClose

      pos.exitCost += px * closingSize
      pos.exitSize += closingSize
      pos.pnl += closedPnl
      pos.fee += feeForClose

      trades.push(finalize(coin, wallet, pos, fill.time))
      positions.delete(coin)

      pos = {
        signedSize: newSigned,
        side: newSigned > 0 ? 'long' : 'short',
        openedAt: fill.time,
        entryCost: px * openingSize,
        entrySize: openingSize,
        exitCost: 0,
        exitSize: 0,
        pnl: 0,
        fee: feeForOpen,
        fillsCount: 1
      }
      positions.set(coin, pos)
      continue
    }

    const isReducing = prevSigned !== 0 && Math.abs(newSigned) < Math.abs(prevSigned)

    if (isReducing) {
      pos.exitCost += px * sz
      pos.exitSize += sz
      pos.pnl += closedPnl
      pos.fee += fee
    } else {
      pos.entryCost += px * sz
      pos.entrySize += sz
      pos.fee += fee
    }

    pos.signedSize = newSigned

    if (sign(newSigned) === 0) {
      trades.push(finalize(coin, wallet, pos, fill.time))
      positions.delete(coin)
    }
  }

  // remaining open positions
  for (const [coin, pos] of positions) {
    trades.push(finalize(coin, wallet, pos, null))
  }

  return trades
}

function finalize(
  coin: string,
  wallet: string,
  pos: {
    side: 'long' | 'short'
    openedAt: number
    entryCost: number
    entrySize: number
    exitCost: number
    exitSize: number
    pnl: number
    fee: number
    fillsCount: number
  },
  closedAtMs: number | null
): Trade {
  const entryPrice = pos.entrySize > 0 ? pos.entryCost / pos.entrySize : 0
  const exitPrice = pos.exitSize > 0 ? pos.exitCost / pos.exitSize : null
  // Closed trades report the full round-trip size; open trades report only the size still outstanding
  // (entrySize accumulates every add within the leg even after partial exits reduce the live position).
  const size = closedAtMs ? pos.entrySize : pos.entrySize - pos.exitSize
  return {
    externalId: `${wallet}-${coin}-${pos.openedAt}`,
    wallet,
    coin,
    side: pos.side,
    status: closedAtMs ? 'closed' : 'open',
    entryPrice,
    exitPrice,
    size,
    notional: entryPrice * size,
    pnl: pos.pnl - pos.fee,
    fee: pos.fee,
    fillsCount: pos.fillsCount,
    openedAt: new Date(pos.openedAt).toISOString(),
    closedAt: closedAtMs ? new Date(closedAtMs).toISOString() : null,
    leverage: null
  }
}
