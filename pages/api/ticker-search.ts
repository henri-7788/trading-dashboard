import { NextApiRequest, NextApiResponse } from 'next'
import { searchTickers } from '../../lib/tickerSearch'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end('Method Not Allowed')
  }

  const q = String(req.query.q || '').trim()
  if (q.length < 1) return res.status(200).json({ results: [] })

  try {
    const results = await searchTickers(q)
    return res.status(200).json({ results })
  } catch (err: any) {
    console.error('ticker search failed', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}
