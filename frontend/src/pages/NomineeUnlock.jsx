import { useEffect, useMemo, useState } from 'react'
import ApprovalStatus from '../components/ApprovalStatus'
import { apiClient } from '../api/client'

function NomineeUnlock({ vaultId, onVaultIdChange }) {
  const [localVaultId, setLocalVaultId] = useState(vaultId || '')
  const [selectedNominee, setSelectedNominee] = useState('')
  const [approvalData, setApprovalData] = useState(null)
  const [releasedShare, setReleasedShare] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLocalVaultId(vaultId || '')
  }, [vaultId])

  const approvedCount = useMemo(
    () => (approvalData?.nominees || []).filter((nominee) => nominee.status === 'approved').length,
    [approvalData]
  )

  const pendingList = useMemo(
    () =>
      (approvalData?.nominees || [])
        .filter((nominee) => nominee.status === 'pending')
        .map((nominee) => nominee.email),
    [approvalData]
  )

  const loadApprovals = async (targetVaultId = vaultId) => {
    if (!targetVaultId) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getApprovals(targetVaultId)
      setApprovalData(response.approvals)
      setReleasedShare('')
      if (!selectedNominee && response.approvals.nominees.length) {
        setSelectedNominee(response.approvals.nominees[0].email)
      }
    } catch (loadError) {
      setError(loadError.message)
      setApprovalData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApprovals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId])

  const handleUseVault = () => {
    onVaultIdChange?.(localVaultId.trim())
  }

  const handleApprove = async () => {
    if (!vaultId || !selectedNominee) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await apiClient.approveUnlock(vaultId, { nominee: selectedNominee })
      await loadApprovals(vaultId)
    } catch (approveError) {
      setError(approveError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchShare = async () => {
    if (!vaultId || !selectedNominee) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.getNomineeShare(vaultId, { nominee: selectedNominee })
      setReleasedShare(response.result.share)
    } catch (shareError) {
      setError(shareError.message)
      setReleasedShare('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page card">
      <div className="page-header">
        <h2>Nominee Unlock</h2>
        <p>Collect approvals and released shares once dead-man switch notifies nominees.</p>
      </div>

      <div className="control-row">
        <label className="field">
          <span>Vault ID</span>
          <input value={localVaultId} onChange={(event) => setLocalVaultId(event.target.value)} />
        </label>
        <div className="action-group">
          <button type="button" className="btn" onClick={handleUseVault} disabled={!localVaultId.trim()}>
            Use Vault
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadApprovals(vaultId)}
            disabled={!vaultId || loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {approvalData && (
        <>
          <p className="vault-meta">
            <strong>{approvalData.vaultName}</strong>
            <span className="pill">{approvalData.status}</span>
          </p>
          <ApprovalStatus
            approved={approvedCount}
            required={approvalData.threshold}
            pending={pendingList}
            nominees={approvalData.nominees}
          />
          <label className="field">
            <span>Nominee</span>
            <select value={selectedNominee} onChange={(event) => setSelectedNominee(event.target.value)}>
              {(approvalData.nominees || []).map((nominee) => (
                <option key={nominee.id} value={nominee.email}>
                  {nominee.email}
                </option>
              ))}
            </select>
          </label>
          <div className="action-group">
            <button type="button" className="btn" onClick={handleApprove} disabled={loading || !selectedNominee}>
              Approve Unlock
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleFetchShare} disabled={loading || !selectedNominee}>
              Fetch Nominee Share
            </button>
          </div>
          {releasedShare && (
            <div className="panel">
              <p>Released share (keep secret):</p>
              <code>{releasedShare}</code>
            </div>
          )}
        </>
      )}

      {loading && <p className="message">Loading...</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  )
}

export default NomineeUnlock
