export function encryptPayload(plainText, secret) {
  if (!plainText || !secret) {
    throw new Error('plainText and secret are required')
  }

  // Template placeholder. Replace with real encryption before production.
  return btoa(`${secret}:${plainText}`)
}
