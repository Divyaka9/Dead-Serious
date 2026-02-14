function getCrypto() {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Crypto API is not available')
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

function bytesToUtf8(value) {
  return new TextDecoder().decode(value)
}

function gfAdd(left, right) {
  return left ^ right
}

function gfMul(left, right) {
  let a = left
  let b = right
  let result = 0

  while (b > 0) {
    if (b & 1) {
      result ^= a
    }

    const carry = a & 0x80
    a = (a << 1) & 0xff

    if (carry) {
      a ^= 0x1b
    }

    b >>= 1
  }

  return result
}

function gfPow(value, exponent) {
  let result = 1
  let base = value
  let power = exponent

  while (power > 0) {
    if (power & 1) {
      result = gfMul(result, base)
    }

    base = gfMul(base, base)
    power >>= 1
  }

  return result
}

function gfInv(value) {
  if (value === 0) {
    throw new Error('cannot invert 0 in GF(256)')
  }

  // In GF(256), a^254 = a^-1 for non-zero a.
  return gfPow(value, 254)
}

function evaluatePolynomial(coefficients, x) {
  let result = 0
  let xPower = 1

  coefficients.forEach((coefficient) => {
    result = gfAdd(result, gfMul(coefficient, xPower))
    xPower = gfMul(xPower, x)
  })

  return result
}

function randomByte() {
  const value = new Uint8Array(1)
  getCrypto().getRandomValues(value)
  return value[0]
}

export function splitSecret(secret, totalShares = 3, threshold = 2) {
  if (!secret) {
    throw new Error('secret is required')
  }

  if (!Number.isInteger(totalShares) || !Number.isInteger(threshold)) {
    throw new Error('totalShares and threshold must be integers')
  }

  if (totalShares < 2) {
    throw new Error('totalShares must be at least 2')
  }

  if (threshold < 2 || threshold > totalShares) {
    throw new Error('threshold must be between 2 and totalShares')
  }

  if (totalShares > 255) {
    throw new Error('totalShares cannot exceed 255')
  }

  const secretBytes = utf8ToBytes(secret)
  const shares = Array.from({ length: totalShares }, (_, index) => ({
    id: index + 1,
    bytes: new Uint8Array(secretBytes.length),
  }))

  for (let byteIndex = 0; byteIndex < secretBytes.length; byteIndex += 1) {
    const coefficients = [secretBytes[byteIndex]]

    for (let degree = 1; degree < threshold; degree += 1) {
      coefficients.push(randomByte())
    }

    shares.forEach((share) => {
      share.bytes[byteIndex] = evaluatePolynomial(coefficients, share.id)
    })
  }

  return shares.map((share) => ({
    id: share.id,
    threshold,
    totalShares,
    value: bytesToBase64(share.bytes),
  }))
}

export function combineShares(shares = []) {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new Error('at least one share is required')
  }

  const parsedShares = shares.map((share) => {
    if (!share || !share.id || !share.threshold || !share.value) {
      throw new Error('share is missing required fields')
    }

    return {
      id: Number(share.id),
      threshold: Number(share.threshold),
      valueBytes: base64ToBytes(share.value),
    }
  })

  const threshold = parsedShares[0].threshold
  if (parsedShares.length < threshold) {
    throw new Error('insufficient shares to reconstruct secret')
  }

  const shareLength = parsedShares[0].valueBytes.length

  parsedShares.forEach((share) => {
    if (share.threshold !== threshold) {
      throw new Error('all shares must have the same threshold')
    }
    if (share.valueBytes.length !== shareLength) {
      throw new Error('all shares must have the same value length')
    }
  })

  const uniqueIds = new Set(parsedShares.map((share) => share.id))
  if (uniqueIds.size !== parsedShares.length) {
    throw new Error('duplicate share IDs are not allowed')
  }

  const selectedShares = parsedShares.slice(0, threshold)
  const secretBytes = new Uint8Array(shareLength)

  for (let byteIndex = 0; byteIndex < shareLength; byteIndex += 1) {
    let secretByte = 0

    for (let i = 0; i < selectedShares.length; i += 1) {
      const current = selectedShares[i]
      let numerator = 1
      let denominator = 1

      for (let j = 0; j < selectedShares.length; j += 1) {
        if (i === j) {
          continue
        }

        const other = selectedShares[j]
        numerator = gfMul(numerator, other.id)
        denominator = gfMul(denominator, gfAdd(current.id, other.id))
      }

      const lagrange = gfMul(numerator, gfInv(denominator))
      secretByte = gfAdd(secretByte, gfMul(current.valueBytes[byteIndex], lagrange))
    }

    secretBytes[byteIndex] = secretByte
  }

  return bytesToUtf8(secretBytes)
}
