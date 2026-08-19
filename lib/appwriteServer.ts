import { Client, Databases } from 'node-appwrite'

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || ''
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || ''
const apiKey = process.env.APPWRITE_API_KEY || ''

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)

export const databases = new Databases(client)

export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'trading_dashboard'
export const TRADES_COLLECTION_ID = process.env.APPWRITE_TRADES_COLLECTION_ID || 'trades'
export const SYNC_STATE_COLLECTION_ID = process.env.APPWRITE_SYNC_STATE_COLLECTION_ID || 'sync_state'
export const CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_CONNECTIONS_COLLECTION_ID || 'connections'
export const HOLDINGS_COLLECTION_ID = process.env.APPWRITE_HOLDINGS_COLLECTION_ID || 'holdings'
export const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions'
