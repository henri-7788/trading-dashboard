import crypto from 'crypto'
import { databases, DATABASE_ID } from './appwriteServer'

export function docIdFor(externalId: string) {
  return crypto.createHash('sha1').update(externalId).digest('hex').slice(0, 36)
}

/**
 * Hyperliquid (and likely other venues) can emit multiple fills sharing the exact same
 * millisecond timestamp, which can collide in a timestamp-derived id. When a create races
 * a concurrent create for the same id, the loser's update can land between the winner's
 * create and its own commit and see a transient 404 — so an update retries past that window
 * instead of failing the whole operation.
 */
export async function upsert(
  collectionId: string,
  documentId: string,
  data: Record<string, unknown>,
  attempt = 0
): Promise<'created' | 'updated'> {
  try {
    await databases.createDocument({ databaseId: DATABASE_ID, collectionId, documentId, data })
    return 'created'
  } catch (err: any) {
    if (err.code !== 409) throw err
    try {
      await databases.updateDocument({ databaseId: DATABASE_ID, collectionId, documentId, data })
      return 'updated'
    } catch (updateErr: any) {
      if (updateErr.code === 404 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
        return upsert(collectionId, documentId, data, attempt + 1)
      }
      throw updateErr
    }
  }
}

/** Keeps the last occurrence of each externalId so two colliding records never race the same upsert. */
export function dedupeByExternalId<T extends { externalId: string }>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) byId.set(item.externalId, item)
  return Array.from(byId.values())
}
