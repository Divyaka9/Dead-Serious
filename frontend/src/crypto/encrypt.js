const SALT_BYTES = 16
const IV_BYTES = 12
const PBKDF2_ITERATIONS = 210000

function getCrypto() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API is not available')
  }
  return cryptoApi
}

function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }

  return Buffer.from(bytes).toString('base64')
}

function utf8ToBytes(value) {
  return new TextEncoder().encode(value)
}

async function deriveKey(secret, salt) {
  const cryptoApi = getCrypto()
  const baseKey = await cryptoApi.subtle.importKey('raw', utf8ToBytes(secret), 'PBKDF2', false, ['deriveKey'])

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptPayload(plainText, secret) {
  if (!plainText || !secret) {
    throw new Error('plainText and secret are required')
  }

  const cryptoApi = getCrypto()
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(secret, salt)

  const encryptedBuffer = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    utf8ToBytes(plainText)
  )

  const cipherBytes = new Uint8Array(encryptedBuffer)

  return {
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(cipherBytes),
  }
}
