import { NextApiRequest, NextApiResponse } from 'next'

const PASSWORD = 'Homburg-1'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { password } = req.body || {}
    if (password === PASSWORD) {
      // set simple cookie
      res.setHeader('Set-Cookie', 'trading_auth=1; Path=/; HttpOnly; SameSite=Strict')
      return res.status(200).json({ success: true })
    }
    return res.status(401).json({ error: 'invalid' })
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'trading_auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict')
    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', 'POST,DELETE')
  res.status(405).end('Method Not Allowed')
}
