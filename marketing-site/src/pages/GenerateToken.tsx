import { useState, FormEvent } from 'react'
import './GenerateToken.css'

// Get API URL from environment or use default
const MYKEYS_URL = (import.meta.env?.VITE_MYKEYS_URL as string) || 'https://mykeys.zip'

interface Step1Data {
  email: string
}

interface Step2Data {
  code: string
  clientId: string
  clientType: string
  expiresInDays: number
  ecosystemAcknowledged: boolean
}

export default function GenerateToken() {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ token: string; expiresAt: string } | null>(null)
  const [step1Data, setStep1Data] = useState<Step1Data>({ email: '' })
  const [step2Data, setStep2Data] = useState<Step2Data>({
    code: '',
    clientId: '',
    clientType: 'generic',
    expiresInDays: 90,
    ecosystemAcknowledged: false,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleStep1Submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: step1Data.email }),
      })

      const data = await response.json()

      // Handle both old format (data.success) and new standardized format (data.status)
      if (response.ok && (data.success || data.status === 'success')) {
        setStep(2)
      } else {
        setError(data.error || data.message || 'Failed to send verification code')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2Submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!step2Data.ecosystemAcknowledged) {
      setError('Please acknowledge the ecosystem terms and conditions')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: step1Data.email,
          code: step2Data.code,
          clientId: step2Data.clientId,
          clientType: step2Data.clientType,
          expiresInDays: step2Data.expiresInDays,
        }),
      })

      const data = await response.json()

      // Handle standardized API response format: { status: 'success', data: { token: ... } }
      if (response.ok && data.status === 'success' && data.data && data.data.token) {
        setSuccess({
          token: data.data.token,
          expiresAt: data.data.expiresAt || new Date().toISOString(),
        })
      } else if (response.ok && data.success && data.token) {
        // Fallback for old format
        setSuccess({
          token: data.token,
          expiresAt: data.expiresAt || new Date().toISOString(),
        })
      } else {
        setError(data.error || data.message || 'Failed to generate token')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate token')
    } finally {
      setLoading(false)
    }
  }

  const [copied, setCopied] = useState(false)

  const copyToken = () => {
    if (success?.token) {
      navigator.clipboard.writeText(success.token).then(() => {
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, 2000)
      }).catch((err) => {
        console.error('Failed to copy token:', err)
        alert('Failed to copy token. Please copy manually.')
      })
    }
  }

  const resendCode = () => {
    setStep(1)
    setError(null)
  }

  return (
    <div className="generate-token-page">
      <div className="container">
        <h1>🔑 Generate Token</h1>
        <p className="subtitle">Create a secure token for CLI and API access</p>

        {/* Step Indicator */}
        <div className="step-indicator">
          <div className="step-info">
            <span className="step-badge">Step {step} of 2</span>
            <span className="step-text">
              {step === 1 ? 'Request Verification Code' : 'Verify Code & Generate Token'}
            </span>
          </div>
          {step === 2 && (
            <div className="step-nav">
              <button onClick={() => setStep(1)} className="step-link">← Back</button>
            </div>
          )}
          <div className="step-progress">
            <div className="step-progress-bar" style={{ width: `${(step / 2) * 100}%` }}></div>
          </div>
        </div>

        {/* How it works */}
        <div className="info-box">
          <p><strong>How it works:</strong></p>
          <p>1. Enter your email address</p>
          <p>2. Receive a verification code via email</p>
          <p>3. Enter the code and Client ID to generate your token</p>
          <p>4. Copy the token for MCP configuration</p>
        </div>

        {/* Step 1: Request Code */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="mfa-request-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={step1Data.email}
                onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
                placeholder="your.email@example.com"
                required
              />
              <small>Enter your email to receive a verification code</small>
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {/* Step 2: Verify Code & Generate Token */}
        {step === 2 && (
          <>
            <div className="info-box success">
              <p><strong>✓ Verification code sent!</strong></p>
              <p>Check your <strong>email</strong> for the 4-digit code sent to {step1Data.email}.</p>
            </div>

            <form onSubmit={handleStep2Submit} className="mfa-verify-form">
              <div className="form-group">
                <label htmlFor="code">Verification Code</label>
                <input
                  type="text"
                  id="code"
                  value={step2Data.code}
                  onChange={(e) => setStep2Data({ ...step2Data, code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="1234"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  required
                />
                <small>Enter the 4-digit code sent to you</small>
              </div>

              <div className="form-group">
                <label htmlFor="clientId">Client ID</label>
                <input
                  type="text"
                  id="clientId"
                  value={step2Data.clientId}
                  onChange={(e) => setStep2Data({ ...step2Data, clientId: e.target.value })}
                  placeholder="e.g., my-agent, cursor-dev"
                  required
                />
                <small>A unique identifier for this token (required)</small>
              </div>

              {/* Advanced Options */}
              <div className="form-group">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="toggle-btn"
                >
                  <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </button>
              </div>

              {showAdvanced && (
                <div className="advanced-options">
                  <div className="form-group">
                    <label htmlFor="clientType">Client Type <span className="optional">(optional)</span></label>
                    <select
                      id="clientType"
                      value={step2Data.clientType}
                      onChange={(e) => setStep2Data({ ...step2Data, clientType: e.target.value })}
                    >
                      <option value="generic">Generic</option>
                      <option value="cursor">Cursor</option>
                      <option value="warp">Warp</option>
                      <option value="other">Other</option>
                    </select>
                    <small>Used for organization only (defaults to "generic")</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="expiresInDays">Expires In (days) <span className="optional">(optional)</span></label>
                    <input
                      type="number"
                      id="expiresInDays"
                      value={step2Data.expiresInDays}
                      onChange={(e) => setStep2Data({ ...step2Data, expiresInDays: parseInt(e.target.value) || 90 })}
                      min={1}
                      max={365}
                    />
                    <small>Default: 90 days</small>
                  </div>
                </div>
              )}

              {/* Terms */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={step2Data.ecosystemAcknowledged}
                    onChange={(e) => setStep2Data({ ...step2Data, ecosystemAcknowledged: e.target.checked })}
                    required
                  />
                  <span>
                    I have read and acknowledge the{' '}
                    <a href="https://xdmiq.com" target="_blank" rel="noopener noreferrer">xdmiq.com</a>,{' '}
                    <a href="https://cosmiciq.org" target="_blank" rel="noopener noreferrer">cosmiciq.org</a>,{' '}
                    <a href="https://mykeys.zip" target="_blank" rel="noopener noreferrer">mykeys.zip</a>,{' '}
                    <a href="https://myl.zip" target="_blank" rel="noopener noreferrer">myl.zip</a>,{' '}
                    and all other owned products ecosystem, including Terms of Service and Privacy Policy.
                  </span>
                </label>
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Generating...' : 'Verify Code & Generate Token'}
              </button>
              <button type="button" onClick={resendCode} className="resend-btn">
                Resend Code
              </button>
            </form>
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>{step === 1 ? 'Sending code...' : 'Generating token...'}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="token-result error">
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="token-result success">
            <h3>✅ Token Generated Successfully!</h3>
            <p>
              <strong>Important:</strong> Save this token now - it will not be shown again!<br />
              Expires: {new Date(success.expiresAt).toLocaleDateString()}
            </p>
            <div className="token-display">
              <div className="token-value">{success.token}</div>
            </div>
            <button 
              onClick={copyToken} 
              className="copy-btn"
              style={{
                background: copied ? '#28a745' : '#667eea',
                transition: 'all 0.2s ease'
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Token'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

