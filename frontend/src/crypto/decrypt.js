const PBKDF2_ITERATIONS = 210000

function getCrypto() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API is not available')
  }
  return cryptoApi
}

function base64ToBytes(value) {
  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  }

  return new Uint8Array(Buffer.from(value, 'base64'))
}

function utf8ToBytes(value) {
  return new TextEncoder().encode(value)
}

function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes)
}

async function deriveKey(secret, salt, iterations) {
  const cryptoApi = getCrypto()
  const baseKey = await cryptoApi.subtle.importKey('raw', utf8ToBytes(secret), 'PBKDF2', false, ['deriveKey'])

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
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

export async function decryptPayload(payload, secret) {
  if (!payload || !secret) {
    throw new Error('payload and secret are required')
  }

  const { salt, iv, cipherText, iterations = PBKDF2_ITERATIONS } = payload

  if (!salt || !iv || !cipherText) {
    throw new Error('payload is missing required fields')
  }

  const cryptoApi = getCrypto()
  const saltBytes = base64ToBytes(salt)
  const ivBytes = base64ToBytes(iv)
  const cipherBytes = base64ToBytes(cipherText)
  const key = await deriveKey(secret, saltBytes, iterations)

  try {
    const plainBuffer = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
      },
      key,
      cipherBytes
    )

    return bytesToUtf8(new Uint8Array(plainBuffer))
  } catch {
    throw new Error('failed to decrypt payload')
  }
}
