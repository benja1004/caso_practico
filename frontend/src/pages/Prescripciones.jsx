import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import jsPDF from 'jspdf'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'

// RF-05: prescripcion digital con firma simulada, codigo QR y detalles anidados
export default function Prescripciones() {
  const { user } = useAuthContext()
  const [prescripciones, setPrescripciones] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [citas, setCitas] = useState([])
  const [form, setForm] = useState({ paciente: '', cita: '', detalles: [{ medicamento: '', dosis: '', frecuencia: '', duracion_dias: 7 }] })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const esMedico = user.rol === 'MEDICO' || user.rol === 'ADMIN'
  // Modal de verificacion por QR
  const [verificarAbierto, setVerificarAbierto] = useState(false)
  const [verificarCodigo, setVerificarCodigo] = useState('')
  const [verificarResultado, setVerificarResultado] = useState(null)
  const [verificarError, setVerificarError] = useState('')

  const hacerVerificacion = async (e, cod = null) => {
    e?.preventDefault?.()
    setVerificarError(''); setVerificarResultado(null)
    const codigo = (cod || verificarCodigo || '').trim().toUpperCase()
    if (!codigo) { setVerificarError('Ingresa el código de verificación de 12 caracteres.'); return }
    try {
      const r = await api(`/prescripciones/verificar/?codigo=${codigo}`)
      setVerificarResultado(r)
    } catch (err) {
      setVerificarError(err.data?.detail || (err.status === 404 ? 'Receta NO encontrada o código inválido.' : err.message))
    }
  }

  const abrirVerificador = (codigo = '') => {
    setVerificarCodigo(codigo); setVerificarResultado(null); setVerificarError(''); setVerificarAbierto(true)
    if (codigo) setTimeout(() => hacerVerificacion(null, codigo), 100)
  }
  const cerrarVerificador = () => setVerificarAbierto(false)

  const cargar = () => api('/prescripciones/?page_size=50').then((d) => setPrescripciones(d.results || d)).catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
    api('/pacientes/?page_size=100').then((d) => setPacientes(d.results || d)).catch(() => {})
    api('/citas/?page_size=100').then((d) => setCitas(d.results || d)).catch(() => {})
  }, [])

  const setDetalle = (i, campo, valor) => {
    const detalles = [...form.detalles]
    detalles[i][campo] = valor
    setForm({ ...form, detalles })
  }
  const addDetalle = () => setForm({ ...form, detalles: [...form.detalles, { medicamento: '', dosis: '', frecuencia: '', duracion_dias: 7 }] })
  const delDetalle = (i) => setForm({ ...form, detalles: form.detalles.filter((_, idx) => idx !== i) })

  const emitir = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      await api('/prescripciones/', { method: 'POST', body: { paciente: form.paciente, cita: form.cita || null, detalles: form.detalles } })
      setMsg('Prescripcion emitida con firma digital (SHA-256) y codigo QR.')
      setForm({ paciente: '', cita: '', detalles: [{ medicamento: '', dosis: '', frecuencia: '', duracion_dias: 7 }] })
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const descargarPDF = (r) => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('SALUDCONNECT - Prescripción Digital', 14, 16)
    doc.setFontSize(11)
    doc.text(`Código de verificación: ${r.codigo_verificacion}`, 14, 26)
    doc.text(`Paciente: ${r.paciente_nombre}`, 14, 33)
    doc.text(`Emitida por: ${r.medico_nombre}`, 14, 40)
    doc.text(`Fecha: ${new Date(r.fecha_emision).toLocaleString('es-PE')}`, 14, 47)
    doc.text(`Vigente hasta: ${new Date(r.vigente_hasta).toLocaleDateString('es-PE')}`, 14, 54)
    // Tabla de medicamentos
    doc.text('Medicamentos:', 14, 64)
    doc.setFontSize(10)
    doc.text('Medicamento', 16, 71); doc.text('Dosis', 90, 71); doc.text('Frecuencia', 120, 71); doc.text('Duración', 160, 71)
    doc.setDrawColor(200); doc.line(14, 73, 195, 73)
    let y = 79
    r.detalles.forEach((d) => {
      doc.text(String(d.medicamento).slice(0, 35), 16, y)
      doc.text(String(d.dosis).slice(0, 25), 90, y)
      doc.text(String(d.frecuencia).slice(0, 30), 120, y)
      doc.text(`${d.duracion_dias} días`, 160, y)
      y += 7
    })
    doc.setFontSize(8)
    doc.text(`Firma digital (SHA-256): ${r.firma_simulada}`, 14, 285)
    doc.text('SALUDCONNECT | Documento verificable escaneando el QR o en /prescripciones/verificar', 14, 290)
    doc.save(`prescripcion_${r.codigo_verificacion}.pdf`)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Prescripciones digitales</h1>
          <div className="sub">Recetas con firma simulada (SHA-256) y código QR de verificación.</div>
        </div>
        <button className="btn btn-outline btn-grande" onClick={() => abrirVerificador('')}>
          Verificar receta por QR
        </button>
      </div>
      {msg && <div className="ok-banner">{msg}</div>}
      {error && <div className="alerta">{error}</div>}

      <div className="grid">
        {esMedico && (
        <div className="card">
          <h2>Emitir prescripcion</h2>
          <form onSubmit={emitir}>
            <label>Paciente</label>
            <select value={form.paciente} onChange={(e) => setForm({ ...form, paciente: e.target.value })} required>
              <option value="">--</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
            </select>
            <label>Cita relacionada (opcional)</label>
            <select value={form.cita} onChange={(e) => setForm({ ...form, cita: e.target.value })}>
              <option value="">-- Sin cita --</option>
              {citas.map((c) => <option key={c.id} value={c.id}>{c.paciente_nombre} - {new Date(c.fecha_hora).toLocaleString('es-PE')}</option>)}
            </select>
            <label>Medicamentos (DetallePrescripcion)</label>
            {form.detalles.map((d, i) => (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', margin: '0.3rem 0' }}>
                <div className="form-row">
                  <div><label>Medicamento</label><input value={d.medicamento} onChange={(e) => setDetalle(i, 'medicamento', e.target.value)} required /></div>
                  <div><label>Dosis</label><input value={d.dosis} onChange={(e) => setDetalle(i, 'dosis', e.target.value)} required /></div>
                </div>
                <div className="form-row">
                  <div><label>Frecuencia</label><input value={d.frecuencia} onChange={(e) => setDetalle(i, 'frecuencia', e.target.value)} required /></div>
                  <div><label>Duracion (dias)</label><input type="number" value={d.duracion_dias} onChange={(e) => setDetalle(i, 'duracion_dias', parseInt(e.target.value))} required /></div>
                </div>
                {form.detalles.length > 1 && <button type="button" className="btn btn-peligro" onClick={() => delDetalle(i)}>Quitar</button>}
              </div>
            ))}
            <button type="button" className="btn btn-sec" onClick={addDetalle} style={{ marginTop: '0.3rem' }}>+ Agregar medicamento</button>
            <div style={{ marginTop: '0.8rem' }}><button className="btn">Emitir y firmar</button></div>
          </form>
          {msg && <div className="ok-banner" style={{ marginTop: '0.6rem' }}>{msg}</div>}
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <div className="card" style={{ gridColumn: esMedico ? 'auto' : '1 / -1' }}>
        <h2>Prescripciones emitidas</h2>
        {prescripciones.map((r) => (
          <div key={r.id} className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ background: '#fff', padding: '6px' }}>
              <QRCode value={r.qr_payload} size={84} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b>{r.paciente_nombre}</b>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {r.medico_nombre} - {new Date(r.fecha_emision).toLocaleDateString('es-PE')}
                <span className={`badge ${new Date(r.vigente_hasta) >= new Date() ? 'estado-CONFIRMADA' : 'estado-CANCELADA'}`} style={{ marginLeft: '0.4rem' }}>
                  {new Date(r.vigente_hasta) >= new Date() ? 'Vigente' : 'Vencida'}
                </span>
              </div>
              <ul style={{ margin: '0.4rem 0', paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
                {r.detalles.map((d) => (
                  <li key={d.id}>{d.medicamento} - {d.dosis} - {d.frecuencia} - {d.duracion_dias} dias</li>
                ))}
              </ul>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Codigo: {r.codigo_verificacion} | Firma: {r.firma_simulada.slice(0, 20)}...
              </div>
            </div>
            <button className="btn btn-sec" onClick={() => descargarPDF(r)}>PDF</button>
            <button className="btn btn-outline" onClick={() => abrirVerificador(r.codigo_verificacion)}>Ver documento</button>
          </div>
        ))}
        {!prescripciones.length && <p style={{ color: '#64748b' }}>No hay prescripciones.</p>}
      </div>
      </div>

      {/* Modal Verificar QR */}
      {true && verificarAbierto && (
        <div className="overlay"
          onClick={(e) => e.target === e.currentTarget && cerrarVerificador()}>
          <div className="modal">
            <div className="modal-head">
              <h2>Verificar autenticidad de receta</h2>
              <button className="modal-close" onClick={cerrarVerificador}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                Ingresa el <b>código de verificación de 12 caracteres</b> (impreso en la receta o contenido en el QR).
                El sistema consulta la validez, vigencia y muestra el documento completo.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input value={verificarCodigo} placeholder="Ej. E30D9380F8F7"
                  onChange={(e) => setVerificarCodigo(e.target.value.toUpperCase())}
                  maxLength={12} />
                <button className="btn" onClick={hacerVerificacion}>Verificar</button>
              </div>
              {verificarError && <div className="alerta" style={{ marginTop: 10 }}>{verificarError}</div>}
              {verificarResultado && verificarResultado.valida && (
                <div className="card" style={{ marginTop: 14, marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {verificarResultado.vigente
                      ? <span className="badge estado-CONFIRMADA">VIGENTE</span>
                      : <span className="badge estado-CANCELADA">VENCIDA</span>}
                    <b style={{ color: '#16a34a' }}>Receta auténtica verificada</b>
                  </div>
                  <div className="info-grid">
                    <div className="item"><div className="k">Código</div><div className="v">{verificarResultado.receta.codigo_verificacion}</div></div>
                    <div className="item"><div className="k">Paciente</div><div className="v">{verificarResultado.receta.paciente_nombre}</div></div>
                    <div className="item"><div className="k">Médico</div><div className="v">{verificarResultado.receta.medico_nombre}</div></div>
                    <div className="item"><div className="k">Emitida</div><div className="v">{new Date(verificarResultado.receta.fecha_emision).toLocaleDateString('es-PE')}</div></div>
                    <div className="item"><div className="k">Vigente hasta</div><div className="v">{new Date(verificarResultado.receta.vigente_hasta).toLocaleDateString('es-PE')}</div></div>
                  </div>
                  <h3 style={{ marginTop: 10 }}>Medicamentos recetados</h3>
                  <table style={{ marginTop: 4 }}>
                    <thead><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th></tr></thead>
                    <tbody>
                      {verificarResultado.receta.detalles.map((d) => (
                        <tr key={d.id}><td>{d.medicamento}</td><td>{d.dosis}</td><td>{d.frecuencia}</td><td>{d.duracion_dias} días</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 8, fontFamily: 'monospace' }}>
                    Firma digital (SHA-256): {verificarResultado.receta.firma_simulada}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button className="btn btn-ok" onClick={() => descargarPDF(verificarResultado.receta)}>Descargar PDF</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}