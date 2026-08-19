import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY is not configured')
  // Accept a 64-char hex string (32 bytes) or fall back to hashing arbitrary input to 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

/** Encrypts a secret for storage. Output format: iv:authTag:ciphertext, all hex. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

/** Decrypts a value produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('malformed encrypted payload')
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return plaintext.toString('utf8')
}

/** Masks a secret for display: keeps the first/last 3 chars, e.g. "abc••••••xyz". */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 6) return '•'.repeat(plaintext.length)
  return `${plaintext.slice(0, 3)}${'•'.repeat(Math.max(4, plaintext.length - 6))}${plaintext.slice(-3)}`
}
