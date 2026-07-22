import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { useAuthContext } from '../context/AuthContext'
import { api } from '../services/api'

// Configurar MFA real: el usuario escanea el QR otpauth:// con Google
// Authenticator (o similar) una sola vez. Luego login usara el codigo del telefono.
export default function MFASetup() {
  const { user, logout } = useAuthContext()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [verificado, setVerificado] = useState(false)
  const [verificarMsg, setVerificarMsg] = useState('')

  useEffect(() => {
    api('/auth/me/mfa-setup/').then((d) => setData(d)).catch((e) => setError(e.message))
  }, [])

  const verificar = async (e) => {
    e.preventDefault()
    setVerificarMsg('')
    try {
      // Reusamos el endpoint /auth/mfa/ con el username actual + el codigo del
      // phone: si valida, el setup esta bien hecho.
      await api('/auth/mfa/', { method: 'POST', body: { username: user.username, code } })
      setVerificado(true)
      setVerificarMsg('✓ ¡MFA configurado! Google Authenticator ya genera tus códigos.')
    } catch (err) {
      setVerificarMsg(err.data?.detail || err.message)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🔐 Configurar autenticación multifactor (MFA)</h1>
          <div className="sub">Escanea el QR una sola vez con Google Authenticator. A partir de entonces, al ingresar usarás el código de 6 dígitos que muestra tu teléfono.</div>
        </div>
      </div>

      {error && <div className="alerta">{error}</div>}
      {!data && !error && <div className="hint">Cargando…</div>}

      {data && (
        <div className="grid-2">
          <div className="card">
            <h2>Paso 1 — Escanea el código QR</h2>
            <div style={{ display: 'grid', placeItems: 'center', padding: 16, background: '#fff' }}>
              <QRCode value={data.otpauth_uri} size={200} />
            </div>
            <div className="info-grid" style={{ marginTop: 12 }}>
              <div className="item"><div className="k">Usuario</div><div className="v">{user.username}</div></div>
              <div className="item"><div className="k">MFA activo</div><div className="v">{data.mfa_enabled ? 'Sí' : 'No'}</div></div>
              <div className="item"><div className="k">Secreto (ingreso manual)</div><div className="v" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{data.secret}</div></div>
            </div>
            <div className="info-banner" style={{ marginTop: 10 }}>
              Si no puedes escanear, abre Google Authenticator → <b>Configurar manualmente</b> →
              escribe TU_USUARIO y el secreto de arriba (sin espacios).
            </div>
            {data.dev_code && <div className="hint">
              <b>Modo demo (DEBUG):</b> tu código actual es <b>{data.dev_code}</b> (cambia cada 30 s).
              El docente puede usar este código para probar el login sin teléfono.
            </div>}
          </div>

          <div className="card">
            <h2>Paso 2 — Verifica que funciona</h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
              Abre Google Authenticator en tu teléfono e ingresa aquí el código de 6 dígitos
              que muestra actualmente.
            </p>
            <form onSubmit={verificar}>
              <label>Código TOTP (6 dígitos)</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" />
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button className="btn btn-ok" disabled={!code || code.length < 6}>Verificar código</button>
                {verificado && <span style={{ color: '#16a34a', alignSelf: 'center', fontWeight: 700 }}>✓ Verificado</span>}
              </div>
              {verificarMsg && <div className={verificado ? 'ok-banner' : 'alerta'} style={{ marginTop: 10 }}>{verificarMsg}</div>}
            </form>
            <div className="info-banner" style={{ marginTop: 14 }}>
              <b>Recuerda:</b> tras configurar MFA, si pierdes el teléfono necesitarás que el
              administrador desbloquee/regenere tu MFA. Conserva el secreto en un lugar seguro.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}