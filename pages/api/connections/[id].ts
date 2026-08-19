import { NextApiRequest, NextApiResponse } from 'next'
import { Query } from 'node-appwrite'
import {
  databases,
  DATABASE_ID,
  CONNECTIONS_COLLECTION_ID,
  HOLDINGS_COLLECTION_ID,
  TRADES_COLLECTION_ID,
  TRANSACTIONS_COLLECTION_ID,
  SYNC_STATE_COLLECTION_ID
} from '../../../lib/appwriteServer'

async function deleteAllWhere(collectionId: string, attribute: string, value: string) {
  for (;;) {
    const result = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId,
      queries: [Query.equal(attribute, value), Query.limit(100)]
    })
    if (result.documents.length === 0) break
    await Promise.all(
      result.documents.map((d) => databases.deleteDocument({ databaseId: DATABASE_ID, collectionId, documentId: d.$id }))
    )
    if (result.documents.length < 100) break
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'Fehlende Verbindungs-ID.' })

  if (req.method === 'DELETE') {
    try {
      await databases.deleteDocument({ databaseId: DATABASE_ID, collectionId: CONNECTIONS_COLLECTION_ID, documentId: id })
      await Promise.all([
        deleteAllWhere(HOLDINGS_COLLECTION_ID, 'connectionId', id),
        deleteAllWhere(TRADES_COLLECTION_ID, 'connectionId', id),
        deleteAllWhere(TRANSACTIONS_COLLECTION_ID, 'source', id),
        deleteAllWhere(SYNC_STATE_COLLECTION_ID, 'connectionId', id)
      ])
      return res.status(200).json({ success: true })
    } catch (err: any) {
      console.error('delete connection failed', err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  }

  res.setHeader('Allow', 'DELETE')
  return res.status(405).end('Method Not Allowed')
}
