import { NextApiRequest, NextApiResponse } from 'next'
import { SUPPORTED_EXCHANGES } from '../../lib/providers/ccxt'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }
  return res.status(200).json({ exchanges: SUPPORTED_EXCHANGES })
}
