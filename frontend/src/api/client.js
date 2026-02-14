const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const AUTH_STORAGE_KEY = 'deadlock-auth-session'

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

function persistSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function getToken() {
  return getStoredSession()?.token || ''
}

async function request(path, options = {}) {
  const token = getToken()
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch {
    throw new Error(`Cannot reach API at ${API_BASE_URL}. Is backend running?`)
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.error || `Request failed: ${response.status}`
    throw new Error(message)
  }

  return payload
}

export const apiClient = {
  getSession: () => getStoredSession(),
  clearSession: () => persistSession(null),

  register: async (body) => {
    const response = await request('/auth/register', { method: 'POST', body: JSON.stringify(body) })
    const session = { token: response.token, user: response.user }
    persistSession(session)
    return response
  },

  login: async (body) => {
    const response = await request('/auth/login', { method: 'POST', body: JSON.stringify(body) })
    const session = { token: response.token, user: response.user }
    persistSession(session)
    return response
  },

  getMe: () => request('/auth/me'),

  createVault: (body) => request('/vault/create', { method: 'POST', body: JSON.stringify(body) }),
  storeShares: (vaultId, body) =>
    request(`/vault/${vaultId}/shares`, { method: 'POST', body: JSON.stringify(body) }),
  uploadEncryptedFile: (vaultId, body) =>
    request(`/vault/${vaultId}/files`, { method: 'POST', body: JSON.stringify(body) }),
  getDashboard: (vaultId) => request(`/vault/${vaultId}/dashboard`),
  checkIn: (vaultId) => request(`/vault/${vaultId}/check-in`, { method: 'POST' }),
  requestUnlock: (vaultId, body) =>
    request(`/vault/${vaultId}/request-unlock`, { method: 'POST', body: JSON.stringify(body) }),
  getApprovals: (vaultId) => request(`/vault/${vaultId}/approvals`),
  approveUnlock: (vaultId, body) =>
    request(`/vault/${vaultId}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  getNomineeShare: (vaultId, body) =>
    request(`/vault/${vaultId}/nominee-share`, { method: 'POST', body: JSON.stringify(body) }),
}
