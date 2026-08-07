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
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_externalId', IndexType.Unique, ['externalId'])
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_openedAt', IndexType.Key, ['openedAt'])
  await ensureIndex(TRADES_COLLECTION_ID, 'idx_status', IndexType.Key, ['status'])

  await ensureCollection(SYNC_STATE_COLLECTION_ID, 'Sync State')
  await ensureStringAttr(SYNC_STATE_COLLECTION_ID, 'wallet', 64, true)
  await ensureIntegerAttr(SYNC_STATE_COLLECTION_ID, 'lastFillTime', true)
  await ensureDatetimeAttr(SYNC_STATE_COLLECTION_ID, 'lastSyncedAt', false)
  await ensureIndex(SYNC_STATE_COLLECTION_ID, 'idx_wallet', IndexType.Unique, ['wallet'])

  console.log('\nDone. Appwrite schema is ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
