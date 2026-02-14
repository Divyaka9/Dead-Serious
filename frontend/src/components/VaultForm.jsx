import { useState } from 'react'

function VaultForm({ onSubmit }) {
  const [vaultName, setVaultName] = useState('')
  const [nominees, setNominees] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit?.({
      vaultName,
      nominees: nominees
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Vault name
        <input
          value={vaultName}
          onChange={(event) => setVaultName(event.target.value)}
          placeholder="Family Documents"
        />
      </label>
      <label>
        Nominees (comma-separated)
        <input
          value={nominees}
          onChange={(event) => setNominees(event.target.value)}
          placeholder="alice@example.com, bob@example.com"
        />
      </label>
      <button type="submit">Create Vault</button>
    </form>
  )
}

export default VaultForm
