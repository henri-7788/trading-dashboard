import { NextApiRequest, NextApiResponse } from 'next'
import { ID, Query } from 'node-appwrite'
import { databases, DATABASE_ID, CONNECTIONS_COLLECTION_ID } from '../../../lib/appwriteServer'
import { encryptSecret, maskSecret, decryptSecret } from '../../../lib/crypto'
import { isSupportedExchange } from '../../../lib/providers/ccxt'

function requireAuth(req: NextApiRequest, res: NextApiResponse): boolean {
  const auth = req.cookies?.trading_auth
  if (!auth || auth !== '1') {
    res.status(401).json({ error: 'unauthorized' })
    return false
  }
  return true
}

function maskDoc(d: any) {
  return {
    id: d.$id,
    type: d.type,
    label: d.label,
    exchangeId: d.exchangeId || null,
    walletAddress: d.walletAddress || null,
    hasApiKey: Boolean(d.apiKeyEnc),
    apiKeyPreview: d.apiKeyEnc ? maskSecret(decryptSecret(d.apiKeyEnc)) : null,
    hasPassword: Boolean(d.passwordEnc),
    symbols: d.symbols || '',
    enabled: d.enabled,
    createdAt: d.createdAt
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res)) return

  if (req.method === 'GET') {
    try {
      const result = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: CONNECTIONS_COLLECTION_ID,
        queries: [Query.orderDesc('createdAt'), Query.limit(100)]
      })
      return res.status(200).json({ connections: result.documents.map(maskDoc) })
    } catch (err: any) {
      console.error('connections list failed', err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const type = body.type

    if (type === 'hyperliquid') {
      const label = String(body.label || 'Hyperliquid').trim()
      const walletAddress = String(body.walletAddress || '').trim()
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Ungültige Wallet-Adresse (erwartet 0x… mit 40 Hex-Zeichen).' })
      }
      try {
        const doc = await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: CONNECTIONS_COLLECTION_ID,
          documentId: ID.unique(),
          data: {
            type: 'hyperliquid',
            label,
            exchangeId: '',
            walletAddress,
            apiKeyEnc: '',
            apiSecretEnc: '',
            passwordEnc: '',
            symbols: '',
            enabled: true,
            createdAt: new Date().toISOString()
          }
        })
        return res.status(200).json({ connection: maskDoc(doc) })
      } catch (err: any) {
        console.error('create hyperliquid connection failed', err)
        return res.status(500).json({ error: err.message || String(err) })
      }
    }

    if (type === 'ccxt') {
      const label = String(body.label || '').trim()
      const exchangeId = String(body.exchangeId || '').trim().toLowerCase()
      const apiKey = String(body.apiKey || '').trim()
      const apiSecret = String(body.apiSecret || '').trim()
      const password = String(body.password || '').trim()
      const symbols = String(body.symbols || '').trim()

      if (!label) return res.status(400).json({ error: 'Bezeichnung ist erforderlich.' })
      if (!isSupportedExchange(exchangeId)) return res.status(400).json({ error: `Unbekannte Börse "${exchangeId}".` })
      if (!apiKey || !apiSecret) return res.status(400).json({ error: 'API-Key und -Secret sind erforderlich.' })

      try {
        const doc = await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: CONNECTIONS_COLLECTION_ID,
          documentId: ID.unique(),
          data: {
            type: 'ccxt',
            label,
            exchangeId,
            walletAddress: '',
            apiKeyEnc: encryptSecret(apiKey),
            apiSecretEnc: encryptSecret(apiSecret),
            passwordEnc: password ? encryptSecret(password) : '',
            symbols,
            enabled: true,
            createdAt: new Date().toISOString()
          }
        })
        return res.status(200).json({ connection: maskDoc(doc) })
      } catch (err: any) {
        console.error('create ccxt connection failed', err)
        return res.status(500).json({ error: err.message || String(err) })
      }
    }

    return res.status(400).json({ error: 'Unbekannter Verbindungstyp.' })
  }

  res.setHeader('Allow', 'GET,POST')
  return res.status(405).end('Method Not Allowed')
}
