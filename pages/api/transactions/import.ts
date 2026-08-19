import { NextApiRequest, NextApiResponse } from 'next'
import { TRANSACTIONS_COLLECTION_ID } from '../../../lib/appwriteServer'
import { upsert, docIdFor } from '../../../lib/upsert'
import { importTradeRepublicCsv } from '../../../lib/importers/traderepublic'
import { validateManualTransaction } from '../../../lib/transactions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const csv = String(req.body?.csv || '')
  if (!csv.trim()) return res.status(400).json({ error: 'Keine Datei erhalten.' })

  let parsed
  try {
    parsed = await importTradeRepublicCsv(csv)
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Datei konnte nicht gelesen werden.' })
  }

  let created = 0
  let updated = 0
  let invalid = 0

  for (const t of parsed.transactions) {
    const error = validateManualTransaction(t)
    if (error) {
      invalid++
      continue
    }
    try {
      const outcome = await upsert(TRANSACTIONS_COLLECTION_ID, docIdFor(t.externalId), { ...t, source: 'manual' })
      if (outcome === 'created') created++
      else updated++
    } catch (err) {
      console.error(`import upsert failed for ${t.externalId}`, err)
      invalid++
    }
  }

  return res.status(200).json({
    totalRows: parsed.totalRows,
    created,
    updated,
    invalid,
    skipped: parsed.skipped,
    unresolvedSymbols: parsed.unresolvedSymbols
  })
}
