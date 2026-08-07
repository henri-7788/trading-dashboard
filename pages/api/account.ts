import { NextApiRequest, NextApiResponse } from 'next'
import { fetchClearinghouseState, fetchSpotClearinghouseState } from '../../lib/hyperliquid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS
  if (!wallet) {
    return res.status(500).json({ error: 'HYPERLIQUID_WALLET_ADDRESS is not configured' })
  }

  try {
    const [perps, spot] = await Promise.all([fetchClearinghouseState(wallet), fetchSpotClearinghouseState(wallet)])

    // Hyperliquid keeps a single USDC balance; the portion locked as perps margin shows up as
    // spot "hold" and already equals the perps accountValue (incl. unrealized PnL). Adding both
    // would double-count that locked amount, so total equity is the spot USDC total alone.
    const spotUsdc = spot.balances.find((b) => b.coin === 'USDC')
    const spotTotal = spotUsdc ? parseFloat(spotUsdc.total) : 0
    const spotHold = spotUsdc ? parseFloat(spotUsdc.hold) : 0
    const spotFree = spotTotal - spotHold

    const perpWithdrawable = parseFloat(perps.withdrawable)

    return res.status(200).json({
      accountValue: spotTotal,
      withdrawable: spotFree + perpWithdrawable,
      totalMarginUsed: parseFloat(perps.marginSummary.totalMarginUsed)
    })
  } catch (err: any) {
    console.error('account fetch failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
