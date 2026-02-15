const { verifyToken } = require('../services/authService')

function nomineeAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  const fallbackToken = String(req.query.token || '').trim()
  const finalToken = scheme === 'Bearer' && token ? token : fallbackToken

  if (!finalToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = verifyToken(finalToken)
    if (payload.type !== 'nominee_access' || !payload.vaultId || !payload.nomineeEmail) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    req.nominee = {
      vaultId: payload.vaultId,
      nomineeEmail: payload.nomineeEmail,
    }
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = nomineeAuth
