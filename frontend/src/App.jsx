import { useState } from 'react'
import CreateVault from './pages/CreateVault'
import Dashboard from './pages/Dashboard'
import NomineeUnlock from './pages/NomineeUnlock'

const TABS = {
  dashboard: 'dashboard',
  createVault: 'createVault',
  nomineeUnlock: 'nomineeUnlock',
}

function App() {
  const [activeTab, setActiveTab] = useState(TABS.dashboard)

  return (
    <main style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1>Dead Serious</h1>
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" onClick={() => setActiveTab(TABS.dashboard)}>
          Dashboard
        </button>
        <button type="button" onClick={() => setActiveTab(TABS.createVault)}>
          Create Vault
        </button>
        <button type="button" onClick={() => setActiveTab(TABS.nomineeUnlock)}>
          Nominee Unlock
        </button>
      </nav>

      {activeTab === TABS.dashboard && <Dashboard />}
      {activeTab === TABS.createVault && <CreateVault />}
      {activeTab === TABS.nomineeUnlock && <NomineeUnlock />}
    </main>
  )
}

export default App
