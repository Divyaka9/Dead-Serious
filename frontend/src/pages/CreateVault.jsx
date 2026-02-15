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

function CreateVault({ currentUser, existingVault, onVaultUpdated }) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [warning, setWarning] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateVault = async (payload) => {
    setError('')
    setSuccess('')
    setWarning('')
    setIsSubmitting(true)

    try {
      const response = await apiClient.upsertMyVault(payload)
      const newVaultId = response?.vault?.vaultId
      if (!newVaultId) {
        throw new Error('Vault saved but no vault ID returned')
      }

      const masterKey = generateMasterKey()
      localStorage.setItem(`deadlock-master-key-${newVaultId}`, masterKey)

      let sharesStored = false
      try {
        const shares = splitSecret(masterKey, 3, 3)
        await apiClient.storeMyShares(
          {
            shares: shares.map((share) => share.value),
            threshold: 3,
            totalShares: 3,
          },
          newVaultId
        )
        sharesStored = true
      } catch (shareError) {
        const message = shareError?.message || 'Failed to store encrypted shares'
        setWarning(
          message.includes('MASTER_SHARE_ENCRYPTION_KEY')
            ? 'Vault saved, but share escrow is unavailable: backend MASTER_SHARE_ENCRYPTION_KEY is not configured.'
            : `Vault saved, but encrypted share storage failed: ${message}`
        )
      }

      localStorage.setItem('deadlock-last-vault-id', newVaultId)
      await onVaultUpdated?.()

      setSuccess(
        existingVault
          ? `Vault updated: ${newVaultId}.${sharesStored ? ' Shares rotated successfully.' : ''}`
          : `Vault created: ${newVaultId}.${sharesStored ? ' 3 encrypted shares stored.' : ''}`
      )
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page card">
      <div className="page-header">
        <h2>{existingVault ? 'Edit Vault' : 'Create Vault'}</h2>
        <p>
          {existingVault
            ? 'Your account has one vault. Update nominees and policy below.'
            : 'Create your single vault and define nominees, threshold, and dead-man switch policy.'}
        </p>
      </div>

      <VaultForm
        onSubmit={handleCreateVault}
        isSubmitting={isSubmitting}
        ownerLabel={currentUser?.email || currentUser?.userId || 'Unknown user'}
        initialValues={existingVault}
        submitLabel={existingVault ? 'Update Vault' : 'Create Vault'}
      />

      {success && <p className="message success">{success}</p>}
      {warning && <p className="message warning">{warning}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  )
}

export default CreateVault