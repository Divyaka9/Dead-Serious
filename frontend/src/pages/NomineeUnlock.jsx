import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

const NOMINEE_SESSION_KEY = 'deadlock-nominee-session'

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(NOMINEE_SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

function NomineeUnlock({ onBackToLogin = null }) {
  const [vaultId, setVaultId] = useState('')
  const [nomineeEmail, setNomineeEmail] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [nomineeSession, setNomineeSession] = useState(() => readSession())

  const [share, setShare] = useState('')
  const [status, setStatus] = useState(null)
  const [nomineeFiles, setNomineeFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (nomineeSession) {
      localStorage.setItem(NOMINEE_SESSION_KEY, JSON.stringify(nomineeSession))
    } else {
      localStorage.removeItem(NOMINEE_SESSION_KEY)
    }
  }, [nomineeSession])

  const handleStartLogin = async () => {
    if (!vaultId.trim() || !nomineeEmail.trim()) {
      setError('Vault ID and nominee email are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiClient.nomineeStartLogin({
        vaultId: vaultId.trim(),
        nomineeEmail: nomineeEmail.trim().toLowerCase(),
      })
      setChallengeToken(response.challengeToken)
      setSuccess(
        response.devCode
          ? `Verification code sent. Dev code: ${response.devCode}`
          : 'Verification code sent to nominee email.'
      )
    } catch (startError) {
      setError(startError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyLogin = async () => {
    if (!challengeToken || !verificationCode.trim()) {
      setError('Challenge token and verification code are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiClient.nomineeVerifyLogin({
        challengeToken,
        code: verificationCode.trim(),
      })

      const session = {
        token: response.token,
        vaultId: response.vaultId,
        vaultName: response.vaultName,
        nominee: response.nominee,
      }
      setNomineeSession(session)
      setSuccess('Nominee login verified. You can now submit your share.')
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    if (!nomineeSession?.token) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.nomineeGetStatus(nomineeSession.token)
      setStatus(response.status)
    } catch (statusError) {
      setError(statusError.message)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitShare = async () => {
    if (!nomineeSession?.token || !share.trim()) {
      setError('A valid nominee session and share are required.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiClient.nomineeSubmitShare(nomineeSession.token, {
        share: share.trim(),
      })
      setSuccess(
        response.result.canAccess
          ? 'All 3 nominee shares submitted. Vault unlocked.'
          : `Share accepted. ${response.result.submittedCount}/3 complete.`
      )
      await handleRefreshStatus()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadFiles = async () => {
    if (!nomineeSession?.token || !share.trim()) {
      setError('A valid nominee session and share are required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiClient.nomineeListFiles(nomineeSession.token, {
        share: share.trim(),
      })
      setNomineeFiles(response.files || [])
    } catch (filesError) {
      setError(filesError.message)
      setNomineeFiles([])
    } finally {
      setLoading(false)
    }
  }

  const handleNomineeLogout = () => {
    setNomineeSession(null)
    setChallengeToken('')
    setVerificationCode('')
    setShare('')
    setStatus(null)
    setNomineeFiles([])
    setError('')
    setSuccess('')
  }

  return (
    <section className="page card">
      <div className="page-header">
        <h2>Nominee Unlock</h2>
        <p>Verify with OTP, submit your share, and track all nominee checkpoint progress.</p>
        {onBackToLogin && (
          <div className="action-group">
            <button type="button" className="btn btn-ghost" onClick={onBackToLogin}>
              Back to Owner Login
            </button>
          </div>
        )}
      </div>

      {!nomineeSession?.token && (
        <>
          <label className="field">
            <span>Vault ID</span>
            <input value={vaultId} onChange={(event) => setVaultId(event.target.value)} />
          </label>
          <label className="field">
            <span>Nominee email</span>
            <input
              type="email"
              value={nomineeEmail}
              onChange={(event) => setNomineeEmail(event.target.value)}
              placeholder="nominee@example.com"
            />
          </label>
          <button type="button" className="btn" onClick={handleStartLogin} disabled={loading}>
            Send OTP
          </button>

          {challengeToken && (
            <>
              <label className="field">
                <span>OTP code</span>
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="Enter 6-digit OTP"
                />
              </label>
              <button type="button" className="btn" onClick={handleVerifyLogin} disabled={loading}>
                Verify OTP
              </button>
            </>
          )}
        </>
      )}

      {!!nomineeSession?.token && (
        <>
          <div className="panel">
            <p>
              Vault: <strong>{nomineeSession.vaultName}</strong>
            </p>
            <p>
              Signed in as: <strong>{nomineeSession.nominee}</strong>
            </p>
            <div className="action-group">
              <button type="button" className="btn btn-ghost" onClick={handleRefreshStatus} disabled={loading}>
                Refresh Nominee Status
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleNomineeLogout}>
                Nominee Logout
              </button>
            </div>
          </div>

          {status && (
            <div className="panel">
              <p>
                Submitted shares: <strong>{status.submittedCount}/3</strong>
              </p>
              <p>
                Access: <strong>{status.canAccess ? 'Unlocked' : 'Locked'}</strong>
              </p>
              <ul className="rows-list">
                {(status.nominees || []).map((person) => (
                  <li key={person.id}>
                    <span>{person.email}</span>
                    <span className="faint">{person.submitted ? 'share submitted' : 'pending'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="field">
            <span>Your share fragment</span>
            <input
              value={share}
              onChange={(event) => setShare(event.target.value)}
              placeholder="Enter your share"
            />
          </label>

          <div className="action-group">
            <button type="button" className="btn" onClick={handleSubmitShare} disabled={loading}>
              Submit Share
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleLoadFiles} disabled={loading}>
              Open Vault Files
            </button>
          </div>

          {!!nomineeFiles.length && (
            <div className="panel">
              <p className="faint">Vault contents</p>
              <ul className="rows-list">
                {nomineeFiles.map((file) => (
                  <li key={file.id}>
                    <span>{file.fileName}</span>
                    <a
                      className="btn btn-ghost btn-inline"
                      href={apiClient.nomineeDownloadUrl(nomineeSession.token, file.id, { share: share.trim() })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {loading && <p className="message">Loading...</p>}
      {success && <p className="message success">{success}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  )
}

export default NomineeUnlock
