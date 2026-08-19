import { NextApiRequest, NextApiResponse } from 'next'
import { computeEquity } from '../../lib/equity'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const equity = await computeEquity()
    return res.status(200).json({ holdings: equity.holdings })
  } catch (err: any) {
    console.error('holdings fetch failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
