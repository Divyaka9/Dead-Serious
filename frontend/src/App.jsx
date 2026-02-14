import { useEffect, useState } from 'react'
import CreateVault from './pages/CreateVault'
import Dashboard from './pages/Dashboard'
import NomineeUnlock from './pages/NomineeUnlock'
import Login from './pages/Login'
import { apiClient } from './api/client'
import './App.css'

const TABS = {
  dashboard: 'dashboard',
  createVault: 'createVault',
  nomineeUnlock: 'nomineeUnlock',
}

const STORED_VAULT_KEY = 'dead-serious-vault-id'
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true'

function App() {
  const [activeTab, setActiveTab] = useState(TABS.dashboard)
  const [vaultId, setVaultId] = useState(() => localStorage.getItem(STORED_VAULT_KEY) || '')
  const [session, setSession] = useState(() => apiClient.getSession())

  useEffect(() => {
    if (vaultId) {
      localStorage.setItem(STORED_VAULT_KEY, vaultId)
    } else {
      localStorage.removeItem(STORED_VAULT_KEY)
    }
  }, [vaultId])

  const handleLogout = () => {
    apiClient.clearSession()
    setSession(null)
    setVaultId('')
  }

  const effectiveSession =
    session?.token || !BYPASS_AUTH
      ? session
      : {
          token: 'dev-bypass',
          user: { userId: 'dev-guest', email: 'guest@local' },
        }

  if (!effectiveSession?.token) {
    return (
      <main className="app-shell">
        <header className="app-header card hero-header">
          <p className="app-kicker">Secure Legacy Vault</p>
          <h1>DEADLOCK</h1>
          <p className="app-mono">YOUR DIGITAL LEGACY, SEALED UNTIL IT MATTERS</p>
          <p className="app-subtitle">
            A cryptographic vault that protects your most sensitive files, passwords, and memories.
          </p>
        </header>
        <Login onAuthenticated={setSession} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="brand">
          <p>DEADLOCK</p>
        </div>
        <div className="user-row">
          <span className="pill status-live">Vault Active</span>
          <span className="pill">{effectiveSession.user?.email || effectiveSession.user?.userId}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tab-nav card" aria-label="Main navigation">
        <button
          type="button"
          className={activeTab === TABS.dashboard ? 'tab-button is-active' : 'tab-button'}
          onClick={() => setActiveTab(TABS.dashboard)}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeTab === TABS.createVault ? 'tab-button is-active' : 'tab-button'}
          onClick={() => setActiveTab(TABS.createVault)}
        >
          Create Vault
        </button>
        <button
          type="button"
          className={activeTab === TABS.nomineeUnlock ? 'tab-button is-active' : 'tab-button'}
          onClick={() => setActiveTab(TABS.nomineeUnlock)}
        >
          Nominee Unlock
        </button>
      </nav>

      <section className="active-vault card">
        <span className="status-dot" />
        <p>
          Active Vault ID: <code>{vaultId || 'None selected'}</code>
        </p>
      </section>

      {activeTab === TABS.dashboard && <Dashboard vaultId={vaultId} onVaultIdChange={setVaultId} />}
      {activeTab === TABS.createVault && (
        <CreateVault onVaultCreated={setVaultId} currentUser={effectiveSession.user} />
      )}
      {activeTab === TABS.nomineeUnlock && (
        <NomineeUnlock vaultId={vaultId} onVaultIdChange={setVaultId} />
      )}
    </main>
  )
}

export default App
