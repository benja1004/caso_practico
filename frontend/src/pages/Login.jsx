import { useState } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { setTokens } from '../services/api'

// RF-01: login en 2 pasos (credenciales + token temporal MFA)
export default function Login() {
  const { login, verifyMfa } = useAuthContext()
  const [paso, setPaso] = useState(1)
  const [username, setUsername] = useState('doctor1')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviarCredenciales = async (e) => {
    e.preventDefault()
    setError(''); setCargando(true)
    try {
      const res = await login(username, password)
      if (res.mfa_required === false) {
        // Usuario sin MFA: login directo (guarda tokens y recarga)
        setTokens(res)
        localStorage.setItem('user', JSON.stringify(res.user))
        window.location.reload()
      } else {
        setDevCode(res.dev_code || '')
        setPaso(2)
      }
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }

  const enviarCodigo = async (e) => {
    e.preventDefault()
    setError(''); setCargando(true)
    try { await verifyMfa(username, code) }
    catch (err) { setError(err.message) } finally { setCargando(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>SALUDCONNECT</h1>
        <p className="sub">Portal de telemedicina - Sierra Central</p>

        {paso === 1 ? (
          <form onSubmit={enviarCredenciales}>
            <label>Usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" required />
            <label>Contrasena</label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
            <div style={{ marginTop: '1rem' }}>
              <button className="btn" style={{ width: '100%' }} disabled={cargando}>
                {cargando ? 'Validando...' : 'Ingresar'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={enviarCodigo}>
            <p className="sub">Se envio un codigo de verificacion (token temporal).</p>
            <label>Codigo MFA (6 digitos)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              maxLength={6} inputMode="numeric" required />
            {devCode && <div className="hint">Modo demo: tu codigo es <b>{devCode}</b></div>}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-sec" onClick={() => setPaso(1)}>Atras</button>
              <button className="btn" style={{ flex: 1 }} disabled={cargando}>Verificar</button>
            </div>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        <div className="hint">
          Demo: <b>admin/admin123</b> | <b>doctor1/doctor123</b> | <b>paciente1/paciente123</b>
        </div>
      </div>
    </div>
  )
}
