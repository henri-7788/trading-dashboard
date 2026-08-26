// One-off setup script: creates the Appwrite database + collections used by the dashboard.
// Run with: node scripts/setup-appwrite.mjs
import { Client, Databases, Permission, Role, DatabasesIndexType as IndexType } from 'node-appwrite'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

if (!endpoint || !project || !apiKey) {
  console.error('Missing NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY in .env.local')
  process.exit(1)
}

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'trading_dashboard'
const TRADES_COLLECTION_ID = process.env.APPWRITE_TRADES_COLLECTION_ID || 'trades'
const SYNC_STATE_COLLECTION_ID = process.env.APPWRITE_SYNC_STATE_COLLECTION_ID || 'sync_state'
const CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_CONNECTIONS_COLLECTION_ID || 'connections'
const HOLDINGS_COLLECTION_ID = process.env.APPWRITE_HOLDINGS_COLLECTION_ID || 'holdings'
const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions'

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
const databases = new Databases(client)

async function ensureDatabase() {
  try {
    await databases.get({ databaseId: DATABASE_ID })
    console.log(`Database "${DATABASE_ID}" already exists.`)
  } catch (err) {
    if (err.code !== 404) throw err
    await databases.create({ databaseId: DATABASE_ID, name: 'Trading Dashboard' })
    console.log(`Created database "${DATABASE_ID}".`)
  }
}

async function ensureCollection(collectionId, name) {
  try {
    await databases.getCollection({ databaseId: DATABASE_ID, collectionId })
    console.log(`Collection "${collectionId}" already exists.`)
    return false
  } catch (err) {
    if (err.code !== 404) throw err
    await databases.createCollection({
      databaseId: DATABASE_ID,
      collectionId,
      name,
      permissions: [Permission.read(Role.any())],
      documentSecurity: false,
      enabled: true
    })
    console.log(`Created collection "${collectionId}".`)
    return true
  }
}

async function ensureStringAttr(collectionId, key, size, required = false, xdefault) {
  try {
    await databases.createStringAttribute({ databaseId: DATABASE_ID, collectionId, key, size, required, xdefault: required ? undefined : xdefault })
    console.log(`  + string attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureFloatAttr(collectionId, key, required = false, xdefault) {
  try {
    await databases.createFloatAttribute({ databaseId: DATABASE_ID, collectionId, key, required, xdefault: required ? undefined : xdefault })
    console.log(`  + float attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureIntegerAttr(collectionId, key, required = false, xdefault) {
  try {
    await databases.createIntegerAttribute({ databaseId: DATABASE_ID, collectionId, key, required, xdefault: required ? undefined : xdefault })
    console.log(`  + integer attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureDatetimeAttr(collectionId, key, required = false) {
  try {
    await databases.createDatetimeAttribute({ databaseId: DATABASE_ID, collectionId, key, required })
    console.log(`  + datetime attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureBooleanAttr(collectionId, key, required = false, xdefault) {
  try {
    await databases.createBooleanAttribute({ databaseId: DATABASE_ID, collectionId, key, required, xdefault: required ? undefined : xdefault })
    console.log(`  + boolean attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureEnumAttr(collectionId, key, elements, required = false, xdefault) {
  try {
    await databases.createEnumAttribute({ databaseId: DATABASE_ID, collectionId, key, elements, required, xdefault: required ? undefined : xdefault })
    console.log(`  + enum attribute ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
  }
}

async function ensureIndex(collectionId, key, type, attributes) {
  try {
    await databases.createIndex({ databaseId: DATABASE_ID, collectionId, key, type, attributes })
    console.log(`  + index ${key}`)
  } catch (err) {
    if (err.code !== 409) throw err
    // An index with this name already exists — if its type drifted (e.g. a unique index that
    // should now be a plain key, as with sync_state.wallet moving from the single-wallet era to
    // multi-connection), recreate it rather than silently keeping the stale constraint.
    const existing = await databases.getIndex({ databaseId: DATABASE_ID, collectionId, key })
    if (existing.type !== type) {
      console.log(`  ~ index ${key} is "${existing.type}", recreating as "${type}"`)
      await databases.deleteIndex({ databaseId: DATABASE_ID, collectionId, key })
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        try {
          await databases.createIndex({ databaseId: DATABASE_ID, collectionId, key, type, attributes })
          console.log(`  + index ${key} (recreated)`)
          break
        } catch (retryErr) {
          if (retryErr.code === 409) continue // deletion still processing
          throw retryErr
        }
      }
    }
  }
}

async function main() {
  await ensureDatabase()

  await ensureCollection(TRADES_COLLECTION_ID, 'Trades')
  await ensureStringAttr(TRADES_COLLECTION_ID, 'externalId', 128, true)
  await ensureStringAttr(TRADES_COLLECTION_ID, 'wallet', 64, true)
  await ensureStringAttr(TRADES_COLLECTION_ID, 'coin', 32, true)
  await ensureEnumAttr(TRADES_COLLECTION_ID, 'side', ['long', 'short'], true)
  await ensureEnumAttr(TRADES_COLLECTION_ID, 'status', ['open', 'closed'], true)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'entryPrice', true)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'exitPrice', false)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'size', true)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'notional', true)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'pnl', true)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'fee', true)
  await ensureIntegerAttr(TRADES_COLLECTION_ID, 'fillsCount', true)
  await ensureDatetimeAttr(TRADES_COLLECTION_ID, 'openedAt', true)
  await ensureDatetimeAttr(TRADES_COLLECTION_ID, 'closedAt', false)
  await ensureFloatAttr(TRADES_COLLECTION_ID, 'leverage', false)
  await ensureStringAttr(TRADES_COLLECTION_ID, 'connectionId', 64, false, '')
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_externalId', IndexType.Unique, ['externalId'])
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_openedAt', IndexType.Key, ['openedAt'])
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_status', IndexType.Key, ['status'])
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_connectionId', IndexType.Key, ['connectionId'])

  await ensureCollection(SYNC_STATE_COLLECTION_ID, 'Sync State')
  await ensureStringAttr(SYNC_STATE_COLLECTION_ID, 'wallet', 64, false, '')
  await ensureStringAttr(SYNC_STATE_COLLECTION_ID, 'connectionId', 64, true)
  await ensureIntegerAttr(SYNC_STATE_COLLECTION_ID, 'lastFillTime', false, 0)
  await ensureDatetimeAttr(SYNC_STATE_COLLECTION_ID, 'lastSyncedAt', false)
  await ensureStringAttr(SYNC_STATE_COLLECTION_ID, 'status', 16, false, 'ok')
  await ensureStringAttr(SYNC_STATE_COLLECTION_ID, 'error', 512, false, '')
  await ensureFloatAttr(SYNC_STATE_COLLECTION_ID, 'cashEquity', false, 0)
  await ensureFloatAttr(SYNC_STATE_COLLECTION_ID, 'cashWithdrawable', false, 0)
  await ensureIndex(SYNC_STATE_COLLECTION_ID, 'idx_wallet', IndexType.Key, ['wallet'])
  await ensureIndex(SYNC_STATE_COLLECTION_ID, 'idx_connectionId', IndexType.Unique, ['connectionId'])

  await ensureCollection(CONNECTIONS_COLLECTION_ID, 'Connections')
  await ensureEnumAttr(CONNECTIONS_COLLECTION_ID, 'type', ['hyperliquid', 'ccxt'], true)
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'label', 64, true)
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'exchangeId', 32, false, '')
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'walletAddress', 128, false, '')
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'apiKeyEnc', 1024, false, '')
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'apiSecretEnc', 1024, false, '')
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'passwordEnc', 1024, false, '')
  await ensureStringAttr(CONNECTIONS_COLLECTION_ID, 'symbols', 1024, false, '')
  await ensureBooleanAttr(CONNECTIONS_COLLECTION_ID, 'enabled', false, true)
  await ensureDatetimeAttr(CONNECTIONS_COLLECTION_ID, 'createdAt', true)
  await ensureIndex(CONNECTIONS_COLLECTION_ID, 'idx_type', IndexType.Key, ['type'])

  await ensureCollection(HOLDINGS_COLLECTION_ID, 'Holdings')
  await ensureStringAttr(HOLDINGS_COLLECTION_ID, 'connectionId', 64, true)
  await ensureStringAttr(HOLDINGS_COLLECTION_ID, 'symbol', 32, true)
  await ensureEnumAttr(HOLDINGS_COLLECTION_ID, 'assetClass', ['crypto', 'stock', 'etf', 'other'], true)
  await ensureFloatAttr(HOLDINGS_COLLECTION_ID, 'quantity', true)
  await ensureFloatAttr(HOLDINGS_COLLECTION_ID, 'avgCost', false)
  await ensureDatetimeAttr(HOLDINGS_COLLECTION_ID, 'updatedAt', true)
  await ensureIndex(HOLDINGS_COLLECTION_ID, 'idx_connSymbol', IndexType.Unique, ['connectionId', 'symbol'])

  await ensureCollection(TRANSACTIONS_COLLECTION_ID, 'Transactions')
  await ensureStringAttr(TRANSACTIONS_COLLECTION_ID, 'source', 64, true)
  await ensureStringAttr(TRANSACTIONS_COLLECTION_ID, 'externalId', 160, false, '')
  await ensureStringAttr(TRANSACTIONS_COLLECTION_ID, 'symbol', 32, true)
  await ensureStringAttr(TRANSACTIONS_COLLECTION_ID, 'name', 128, false, '')
  await ensureEnumAttr(TRANSACTIONS_COLLECTION_ID, 'assetClass', ['crypto', 'stock', 'etf', 'other'], true)
  await ensureEnumAttr(TRANSACTIONS_COLLECTION_ID, 'side', ['buy', 'sell'], true)
  await ensureFloatAttr(TRANSACTIONS_COLLECTION_ID, 'quantity', true)
  await ensureFloatAttr(TRANSACTIONS_COLLECTION_ID, 'price', true)
  await ensureFloatAttr(TRANSACTIONS_COLLECTION_ID, 'fee', false, 0)
  await ensureDatetimeAttr(TRANSACTIONS_COLLECTION_ID, 'executedAt', true)
  await ensureStringAttr(TRANSACTIONS_COLLECTION_ID, 'notes', 256, false, '')
  await ensureIndex(TRANSACTIONS_COLLECTION_ID, 'idx_externalId', IndexType.Unique, ['externalId'])
  await ensureIndex(TRANSACTIONS_COLLECTION_ID, 'idx_source', IndexType.Key, ['source'])
  await ensureIndex(TRANSACTIONS_COLLECTION_ID, 'idx_executedAt', IndexType.Key, ['executedAt'])

  console.log('\nDone. Appwrite schema is ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
