import { NextApiRequest, NextApiResponse } from 'next'
import { databases, DATABASE_ID, TRANSACTIONS_COLLECTION_ID } from '../../../lib/appwriteServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Fehlende Transaktions-ID.' })

  if (req.method === 'DELETE') {
    try {
      const doc = await databases.getDocument({ databaseId: DATABASE_ID, collectionId: TRANSACTIONS_COLLECTION_ID, documentId: id })
      if (doc.source !== 'manual') {
        return res.status(400).json({ error: 'Nur manuell erfasste Einträge können gelöscht werden.' })
      }
      await databases.deleteDocument({ databaseId: DATABASE_ID, collectionId: TRANSACTIONS_COLLECTION_ID, documentId: id })
      return res.status(200).json({ success: true })
    } catch (err: any) {
      console.error('delete transaction failed', err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  }

  res.setHeader('Allow', 'DELETE')
  return res.status(405).end('Method Not Allowed')
}
