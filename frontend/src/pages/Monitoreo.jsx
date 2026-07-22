import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import { useHealthReducer } from '../hooks/useHealthReducer'
import { enqueueSigno, getQueue, isOnline, syncQueue } from '../services/offlineStore'

// RF-03: registro de signos vitales con alertas por rango (ajustado por condicion cronica)
// RNF-03: modo offline con sincronizacion al recuperar conexion
export default function Monitoreo() {
  const { user } = useAuthContext()
  const [state, dispatch] = useHealthReducer()
  const [pacientes, setPacientes] = useState([])
  const [form, setForm] = useState({ paciente: '', tipo: 'GLUCOSA', valor: '', valor_sistolica: '', valor_diastolica: '' })
  const [msg, setMsg] = useState('')
  const [online, setOnline] = useState(isOnline())

  const cargar = async () => {
    dispatch({ type: 'CARGANDO' })
    try {
      const d = await api('/signos/?page_size=50')
      dispatch({ type: 'SET_SIGNOS', payload: d.results || d })
    } catch (e) { dispatch({ type: 'ERROR', payload: e.message }) }
  }

  useEffect(() => {
    cargar()
    api('/pacientes/?page_size=100').then((d) => {
      const lista = d.results || d
      setPacientes(lista)
      if (lista.length) setForm((f) => ({ ...f, paciente: String(lista[0].id) }))
    }).catch(() => {})
    dispatch({ type: 'SET_PENDIENTES', payload: getQueue().length })
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const registrar = async (e) => {
    e.preventDefault()
    setMsg('')
    const isPresion = form.tipo === 'PRESION'
    const body = {
      paciente: form.paciente, tipo: form.tipo,
      valor: isPresion ? null : parseFloat(form.valor),
      valor_sistolica: isPresion ? parseFloat(form.valor_sistolica) : null,
      valor_diastolica: isPresion ? parseFloat(form.valor_diastolica) : null,
      unidad: { GLUCOSA: 'mg/dL', PRESION: 'mmHg', SPO2: '%', TEMPERATURA: '°C' }[form.tipo],
    }
    if (!online) {
      const n = enqueueSigno(body)
      dispatch({ type: 'SET_PENDIENTES', payload: n })
      setMsg(`Sin conexion: guardado en cola offline (${n} pendientes).`)
      return
    }
    try {
      const creado = await api('/signos/', { method: 'POST', body })
      dispatch({ type: 'ADD_SIGNO', payload: creado })
      const r = creado.rango_aplicado
      setMsg(creado.fuera_de_rango
        ? `ALERTA ${creado.nivel_alerta}: ${isPresion ? body.valor_sistolica + '/' + body.valor_diastolica : body.valor} ${body.unidad} fuera de rango (${r?.min}-${r?.max}).`
        : `OK (en rango ${r?.min}-${r?.max} ${r?.unidad}).`)
      setForm((f) => ({ ...f, valor: '', valor_sistolica: '', valor_diastolica: '' }))
    } catch (err) {
      const n = enqueueSigno(body)
      dispatch({ type: 'SET_PENDIENTES', payload: n })
      setMsg(`Error de red: guardado en cola offline (${n} pendientes).`)
    }
  }

  const sincronizar = async () => {
    const r = await syncQueue()
    dispatch({ type: 'SET_PENDIENTES', payload: r.pendientes || 0 })
    setMsg(`Sincronizados ${r.sincronizados} registros offline.`)
    cargar()
  }

  const isPresion = form.tipo === 'PRESION'

  return (
    <div>
      {!online && <div className="alerta">Modo OFFLINE activo: los registros se guardan localmente y se sincronizaran al recuperar conexion.</div>}
      {state.pendientesOffline > 0 && online && (
        <div className="alerta">
          {state.pendientesOffline} registro(s) pendientes de sincronizar.
          <button className="btn btn-ok" style={{ marginLeft: '0.6rem' }} onClick={sincronizar}>Sincronizar ahora</button>
        </div>
      )}
      <div className="grid">
        <div className="card">
          <h2>Registrar signo vital</h2>
          <form onSubmit={registrar}>
            <label>Paciente</label>
            <select value={form.paciente} onChange={(e) => setForm({ ...form, paciente: e.target.value })} required>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo} ({(p.condiciones || []).map((c) => c.nombre).join(', ') || 'sin condicion'})</option>)}
            </select>
            <label>Tipo de signo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="GLUCOSA">Glucosa (mg/dL)</option>
              <option value="PRESION">Presion arterial (mmHg)</option>
              <option value="SPO2">SpO2 (%)</option>
              <option value="TEMPERATURA">Temperatura (°C)</option>
            </select>
            {isPresion ? (
              <div className="form-row">
                <div><label>Sistolica</label><input type="number" value={form.valor_sistolica} onChange={(e) => setForm({ ...form, valor_sistolica: e.target.value })} required /></div>
                <div><label>Diastolica</label><input type="number" value={form.valor_diastolica} onChange={(e) => setForm({ ...form, valor_diastolica: e.target.value })} required /></div>
              </div>
            ) : (
              <>
                <label>Valor</label>
                <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
              </>
            )}
            <div style={{ marginTop: '0.8rem' }}>
              <button className="btn">{online ? 'Registrar' : 'Guardar offline'}</button>
            </div>
          </form>
          {msg && <div className="ok-banner" style={{ marginTop: '0.6rem' }}>{msg}</div>}
          {state.error && <p className="error">{state.error}</p>}
        </div>

        <div className="card">
          <h2>Alertas activas ({state.alertas.length})</h2>
          {state.alertas.slice(0, 8).map((s) => (
            <div key={s.id} className="alerta">
              <b>{s.paciente_nombre}</b> - {s.tipo}: {s.tipo === 'PRESION' ? `${s.valor_sistolica}/${s.valor_diastolica}` : `${s.valor} ${s.unidad}`}
              {s.nivel_alerta && <span className={`badge estado-${s.nivel_alerta}`} style={{ marginLeft: '0.4rem' }}>{s.nivel_alerta}</span>}
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Rango: {s.rango_aplicado?.min}-{s.rango_aplicado?.max} {s.rango_aplicado?.unidad} | por {s.registrado_por === user.id ? 'ti' : 'personal'}</div>
            </div>
          ))}
          {!state.alertas.length && <p style={{ color: '#64748b' }}>Sin alertas activas.</p>}
        </div>
      </div>

      <div className="card">
        <h2>Ultimos registros</h2>
        <table>
          <thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Valor</th><th>Origen</th><th>Alerta</th></tr></thead>
          <tbody>
            {state.signos.slice(0, 15).map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.registrado_en).toLocaleString('es-PE')}</td>
                <td>{s.paciente_nombre}</td>
                <td>{s.tipo}</td>
                <td><b style={{ color: s.fuera_de_rango ? '#e74c3c' : 'inherit' }}>
                  {s.tipo === 'PRESION' ? `${s.valor_sistolica}/${s.valor_diastolica}` : `${s.valor} ${s.unidad || ''}`}
                </b></td>
                <td>{s.origen}</td>
                <td>{s.nivel_alerta || 'OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}