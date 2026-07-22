import { useState } from 'react'
import QrReader from 'react-qr-scanner'

export default function VerificarQR() {
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const verificar = async (cod) => {
    const cleanCod = (cod || '').trim().toUpperCase()
    if (!cleanCod) {
      setError('Por favor ingresa un código de verificación.')
      return
    }
    setError('')
    setResultado(null)
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/prescripciones/verificar/?codigo=${cleanCod}`)
      if (!r.ok) {
        if (r.status === 404) {
          setError('Receta NO encontrada o código inválido.')
        } else {
          setError('Ocurrió un error al verificar la receta.')
        }
        setLoading(false)
        return
      }
      const d = await r.json()
      setResultado(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleScan = (res) => {
    if (res && res.text) {
      const parts = res.text.split('|')
      const cod = parts.length > 1 ? parts[1] : res.text
      setCodigo(cod.toUpperCase())
      verificar(cod)
    }
  }

  const handleError = (err) => {
    console.error(err)
  }

  return (
    <div style={{ maxWidth: 650, margin: '2rem auto', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>Verificar Receta Médica</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.4rem' }}>
          Escanea el código QR de la receta con tu cámara o digita el código de verificación manualmente.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: '#334155' }}>Escanear con Cámara</h3>
        <div style={{ borderRadius: '8px', overflow: 'hidden', background: '#000', position: 'relative', width: '100%', height: '240px' }}>
          <QrReader
            delay={500}
            constraints={{ facingMode: 'environment' }}
            onError={handleError}
            onScan={handleScan}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1rem', color: '#334155' }}>Verificación Manual</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={codigo}
            placeholder="Ej. E30D9380F8F7"
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            maxLength={12}
            style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
          />
          <button className="btn" onClick={() => verificar(codigo)} disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </div>
      </div>

      {error && <div className="alerta" style={{ marginBottom: '1.5rem', padding: '0.8rem', borderRadius: '8px' }}>{error}</div>}

      {resultado && resultado.valida && (
        <div className="card" style={{ marginTop: '1.5rem', borderRadius: '12px', border: '1px solid #bbf7d0', background: 'rgba(240, 253, 244, 0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {resultado.vigente ? (
              <span className="badge estado-CONFIRMADA" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>VIGENTE</span>
            ) : (
              <span className="badge estado-CANCELADA" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>VENCIDA</span>
            )}
            <b style={{ color: '#16a34a', fontSize: '1.05rem' }}>Receta auténtica verificada</b>
          </div>

          <div className="info-grid" style={{ gap: '10px', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div className="item"><div className="k">Código</div><div className="v"><b>{resultado.receta.codigo_verificacion}</b></div></div>
            <div className="item"><div className="k">Paciente</div><div className="v">{resultado.receta.paciente_nombre}</div></div>
            <div className="item"><div className="k">Médico</div><div className="v">{resultado.receta.medico_nombre}</div></div>
            <div className="item"><div className="k">Emitida</div><div className="v">{new Date(resultado.receta.fecha_emision).toLocaleDateString('es-PE')}</div></div>
            <div className="item"><div className="k">Vigente hasta</div><div className="v">{new Date(resultado.receta.vigente_hasta).toLocaleDateString('es-PE')}</div></div>
          </div>

          <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '1rem', color: '#1e293b' }}>Medicamentos Recetados</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Medicamento</th>
                  <th style={{ padding: '0.4rem' }}>Dosis</th>
                  <th style={{ padding: '0.4rem' }}>Frecuencia</th>
                  <th style={{ padding: '0.4rem' }}>Duración</th>
                </tr>
              </thead>
              <tbody>
                {resultado.receta.detalles.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.4rem' }}><b>{d.medicamento}</b></td>
                    <td style={{ padding: '0.4rem' }}>{d.dosis}</td>
                    <td style={{ padding: '0.4rem' }}>{d.frecuencia}</td>
                    <td style={{ padding: '0.4rem' }}>{d.duracion_dias} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1.2rem', fontFamily: 'monospace', wordBreak: 'break-all', padding: '0.6rem', background: '#f1f5f9', borderRadius: '6px' }}>
            <b>Firma digital (SHA-256):</b><br />
            {resultado.receta.firma_simulada}
          </div>

          <div style={{ marginTop: '1.2rem', display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-ok"
              style={{ width: '100%' }}
              onClick={() => window.open(`/api/v1/prescripciones/${resultado.receta.id}/pdf/?codigo=${resultado.receta.codigo_verificacion}`, '_blank')}
            >
              Descargar PDF Oficial
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
