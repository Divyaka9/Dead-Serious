import { useState } from 'react'
import VaultForm from '../components/VaultForm'
import { apiClient } from '../api/client'
import { splitSecret } from '../crypto/shamir'

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function generateMasterKey() {
  const keyBytes = new Uint8Array(32)
  crypto.getRandomValues(keyBytes)
  return bytesToBase64(keyBytes)
}

function CreateVault({ onVaultCreated, currentUser }) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateVault = async (payload) => {
    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const response = await apiClient.createVault(payload)
      const newVaultId = response?.vault?.vaultId
      if (!newVaultId) {
        throw new Error('Vault created but no vault ID returned')
      }

      const masterKey = generateMasterKey()
      const shares = splitSecret(masterKey, 3, 3)
      await apiClient.storeShares(newVaultId, {
        shares: shares.map((share) => share.value),
        threshold: 3,
        totalShares: 3,
      })

      localStorage.setItem(`deadlock-master-key-${newVaultId}`, masterKey)

      onVaultCreated?.(newVaultId)
      setSuccess(`Vault created: ${newVaultId}. 3 encrypted shares stored.`)
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page card">
      <div className="page-header">
        <h2>Create Vault</h2>
        <p>Define nominees, threshold, and dead-man switch policy for your protected vault.</p>
      </div>
      <VaultForm
        onSubmit={handleCreateVault}
        isSubmitting={isSubmitting}
        ownerLabel={currentUser?.email || currentUser?.userId || 'Unknown user'}
      />
      {success && <p className="message success">{success}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  )
}

export default CreateVault
