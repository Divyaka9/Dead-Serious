export function decryptPayload(cipherText, secret) {
  if (!cipherText || !secret) {
    throw new Error('cipherText and secret are required')
  }

  // Template placeholder. Replace with real decryption before production.
  const decoded = atob(cipherText)
  const [prefix, ...rest] = decoded.split(':')

  if (prefix !== secret) {
    throw new Error('invalid secret')
  }

  return rest.join(':')
}
