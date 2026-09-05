import { useState, type FormEvent } from 'react'
import { login } from '../lib/api'
import { Field } from '../components/ui'

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(password)
      onSuccess()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card stack" onSubmit={submit}>
        <div>
          <h1>Planner</h1>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Enter your password to continue.
          </p>
        </div>

        {error && <div className="banner">{error}</div>}

        <Field label="Password">
          <input
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <button className="btn primary" type="submit" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
