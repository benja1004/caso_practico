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
    doc.text('SALUDCONNECT - Prescripcion Digital', 14, 16)
    doc.setFontSize(11)
    doc.text(`Codigo de verificacion: ${r.codigo_verificacion}`, 14, 26)
    doc.text(`Paciente: ${r.paciente_nombre}`, 14, 33)
    doc.text(`Emitida por: ${r.medico_nombre}`, 14, 40)
    doc.text(`Fecha: ${new Date(r.fecha_emision).toLocaleString('es-PE')}`, 14, 47)
    doc.text(`Vigente hasta: ${new Date(r.vigente_hasta).toLocaleDateString('es-PE')}`, 14, 54)
    doc.text('Medicamentos:', 14, 64)
    let y = 72
    r.detalles.forEach((d) => {
      doc.text(`- ${d.medicamento} | ${d.dosis} | ${d.frecuencia} | ${d.duracion_dias} dias`, 20, y)
      y += 7
    })
    doc.setFontSize(8)
    doc.text(`Firma digital (SHA-256): ${r.firma_simulada}`, 14, 285)
    doc.save(`prescripcion_${r.codigo_verificacion}.pdf`)
  }

  return (
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
          </div>
        ))}
        {!prescripciones.length && <p style={{ color: '#64748b' }}>No hay prescripciones.</p>}
      </div>
    </div>
  )
}