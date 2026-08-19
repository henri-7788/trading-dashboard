import { NextApiRequest, NextApiResponse } from 'next'
import { ID, Query } from 'node-appwrite'
import { databases, DATABASE_ID, TRANSACTIONS_COLLECTION_ID } from '../../../lib/appwriteServer'
import { validateManualTransaction } from '../../../lib/transactions'

function mapDoc(d: any) {
  return {
    id: d.$id,
    source: d.source,
    editable: d.source === 'manual',
    symbol: d.symbol,
    name: d.name || d.symbol,
    assetClass: d.assetClass,
    side: d.side,
    quantity: d.quantity,
    price: d.price,
    fee: d.fee || 0,
    executedAt: d.executedAt,
    notes: d.notes || ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const docs: any[] = []
      let cursor: string | undefined
      for (;;) {
        const queries = [Query.orderDesc('executedAt'), Query.limit(100)]
        if (cursor) queries.push(Query.cursorAfter(cursor))
        const result = await databases.listDocuments({ databaseId: DATABASE_ID, collectionId: TRANSACTIONS_COLLECTION_ID, queries })
        docs.push(...result.documents)
        if (result.documents.length < 100) break
        cursor = result.documents[result.documents.length - 1].$id
      }
      return res.status(200).json({ transactions: docs.map(mapDoc) })
    } catch (err: any) {
      console.error('transactions list failed', err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const input = {
      symbol: String(body.symbol || '').trim().toUpperCase(),
      name: String(body.name || '').trim(),
      assetClass: body.assetClass,
      side: body.side,
      quantity: parseFloat(body.quantity),
      price: parseFloat(body.price),
      fee: body.fee != null ? parseFloat(body.fee) : 0,
      executedAt: body.executedAt,
      notes: String(body.notes || '').trim()
    }
    const error = validateManualTransaction(input)
    if (error) return res.status(400).json({ error })

    try {
      const doc = await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: TRANSACTIONS_COLLECTION_ID,
        documentId: ID.unique(),
        data: {
          source: 'manual',
          externalId: `manual-${ID.unique()}`,
          symbol: input.symbol,
          name: input.name,
          assetClass: input.assetClass,
          side: input.side,
          quantity: input.quantity,
          price: input.price,
          fee: input.fee || 0,
          executedAt: new Date(input.executedAt).toISOString(),
          notes: input.notes
        }
      })
      return res.status(200).json({ transaction: mapDoc(doc) })
    } catch (err: any) {
      console.error('create manual transaction failed', err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
