import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'

// RF-11: plantilla semanal recurrente + BloqueoAgenda.
// Conectado con el flujo de Citas: de aqui nacen los slots disponibles.
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

export default function Horario() {
  const { user } = useAuthContext()
  const [horarios, setHorarios] = useState([])
  const [bloqueos, setBloqueos] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [citasHoy, setCitasHoy] = useState([])
  const [form, setForm] = useState({ dia_semana: 0, hora_inicio: '08:00', hora_fin: '13:00', duracion_cita_min: 30 })
  const [bloqForm, setBloqForm] = useState({ fecha_inicio: '', fecha_fin: '', hora_inicio: '', hora_fin: '', motivo: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [editandoId, setEditandoId] = useState(null)

  const cargar = async () => {
    try {
      const [h, b, p] = await Promise.all([
        api('/horarios/'),
        api('/bloqueos/'),
        api('/perfiles-medico/?page_size=100').then((d) => {
          // busca el perfil del medico actual
          const arr = d.results || d
          return arr.find((x) => String(x.usuario) === String(user.id)) || arr[0] || null
        }),
      ])
      setHorarios(h.results || h)
      setBloqueos(b.results || b)
      setPerfil(p)
      //Citas de hoy para el panel de info
      try {
        const today = new Date().toISOString().slice(0, 10)
        const c = await api(`/citas/?page_size=100`)
        const arr = c.results || c
        setCitasHoy(arr.filter((x) => x.fecha_hora.startsWith(today) && x.estado !== 'CANCELADA'))
      } catch { setCitasHoy([]) }
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { cargar() }, [])

  const crearHorario = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      if (editandoId) {
        await api(`/horarios/${editandoId}/`, { method: 'PATCH', body: form })
        setMsg('Horario actualizado. La nueva disponibilidad ya se refleja al agendar citas.')
        setEditandoId(null)
      } else {
        await api('/horarios/', { method: 'POST', body: form })
        setMsg('Horario guardado. La disponibilidad ya se calcula automáticamente al agendar citas.')
      }
      setForm({ dia_semana: 0, hora_inicio: '08:00', hora_fin: '13:00', duracion_cita_min: 30 })
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const editar = (h) => {
    setEditandoId(h.id)
    setForm({
      dia_semana: h.dia_semana, hora_inicio: h.hora_inicio.slice(0, 5),
      hora_fin: h.hora_fin.slice(0, 5), duracion_cita_min: h.duracion_cita_min,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setForm({ dia_semana: 0, hora_inicio: '08:00', hora_fin: '13:00', duracion_cita_min: 30 })
  }

  const toggleHorario = async (h) => {
    await api(`/horarios/${h.id}/`, { method: 'PATCH', body: { activo: !h.activo } })
    cargar()
  }

  const eliminarHorario = async (h) => {
    if (!confirm('¿Eliminar este bloque de horario? Las citas ya agendadas NO se borran pero ya no se generarian nuevos slots aquí.')) return
    await api(`/horarios/${h.id}/`, { method: 'DELETE' })
    setMsg('Horario eliminado.')
    cargar()
  }

  const eliminarBloqueo = async (b) => {
    if (!confirm('¿Eliminar este bloqueo?')) return
    await api(`/bloqueos/${b.id}/`, { method: 'DELETE' })
    cargar()
  }

  const crearBloqueo = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    const body = { ...bloqForm }
    if (!body.hora_inicio) delete body.hora_inicio
    if (!body.hora_fin) delete body.hora_fin
    try {
      await api('/bloqueos/', { method: 'POST', body })
      setMsg('Bloqueo registrado. El paciente no verá el motivo (privacidad).')
      setBloqForm({ fecha_inicio: '', fecha_fin: '', hora_inicio: '', hora_fin: '', motivo: '' })
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const activosCount = horarios.filter((h) => h.activo).length
  const disponibilSemanal = horarios.filter((h) => h.activo)
    .reduce((acc, h) => acc + Math.floor((h.hora_fin.slice(0, 2) * 60 + +h.hora_fin.slice(3, 5) - h.hora_inicio.slice(0, 2) * 60 - +h.hora_inicio.slice(3, 5)) / h.duracion_cita_min), 0)

  return (
    <div>
      {/* Hero con info grande del medico */}
      <div className="medico-hero">
        <div className="fila">
          <div className="medico-avatar">{(user.first_name?.[0] || 'D').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <h1>Dr(a). {user.first_name} {user.last_name}</h1>
            <div className="esp">{perfil?.especialidad_nombre || '—'} · N° colegiatura: {perfil?.numero_colegiatura || '—'}</div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: 2 }}>
              Centro: {perfil?.centro_salud_nombre || '—'}
            </div>
          </div>
        </div>
        <div className="medico-stats">
          <div className="ms"><div className="n">{activosCount}</div><div className="l">Bloques activos / semana</div></div>
          <div className="ms"><div className="n">~{disponibilSemanal}</div><div className="l">Slots disponibles / semana</div></div>
          <div className="ms"><div className="n">{citasHoy.length}</div><div className="l">Citas HOY</div></div>
          <div className="ms"><div className="n">{bloqueos.length}</div><div className="l">Bloqueos vigentes</div></div>
        </div>
      </div>

      <div className="info-banner">
        <b>¿Para qué sirve esto?</b> Aquí configuras tu plantilla semanal recurrente (qué días y horas atiendes).
        Los pacientes, al agendar una cita, solo verán slots derivados de esta plantilla (menos los ya ocupados o bloqueados).
        Sin estos horarios <b>no se generan slots disponibles</b>.
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>{editandoId ? '✏️ Editar horario' : '➕ Nuevo bloque de horario'}</h2>
          <form onSubmit={crearHorario}>
            <label>Día de la semana</label>
            <select value={form.dia_semana} onChange={(e) => setForm({ ...form, dia_semana: parseInt(e.target.value) })}>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <div className="form-row">
              <div><label>Desde</label><input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} required /></div>
              <div><label>Hasta</label><input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} required /></div>
            </div>
            <label>Duración de cada cita (minutos)</label>
            <input type="number" min={10} max={120} step={5} value={form.duracion_cita_min} onChange={(e) => setForm({ ...form, duracion_cita_min: parseInt(e.target.value) })} required />
            <div className="info-banner" style={{ marginTop: 8, fontSize: '0.8rem' }}>
              <b>Restricciones:</b>
              <ul className="lista-restricciones">
                <li>No dos horarios pueden superponerse el mismo día.</li>
                <li>La hora de inicio debe ser menor que la de fin.</li>
                <li>Puedes desactivar un bloque sin borrarlo (botón "Desactivar").</li>
                <li>Borrar un horario NO cancela citas ya agendadas, solo impide nuevas.</li>
              </ul>
            </div>
            <div style={{ marginTop: '0.8rem', display: 'flex', gap: 8 }}>
              <button className="btn">{editandoId ? 'Guardar cambios' : 'Guardar horario'}</button>
              {editandoId && <button className="btn btn-outline" onClick={cancelarEdicion}>Cancelar edición</button>}
            </div>
          </form>
          {msg && <div className="ok-banner" style={{ marginTop: '0.6rem' }}>{msg}</div>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="card">
          <h2>Bloqueo de agenda (excepciones)</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Vacaciones, capacitaciones o imprevistos. El <b>motivo nunca se muestra al paciente</b>.</p>
          <form onSubmit={crearBloqueo}>
            <div className="form-row">
              <div><label>Fecha inicio</label><input type="date" value={bloqForm.fecha_inicio} onChange={(e) => setBloqForm({ ...bloqForm, fecha_inicio: e.target.value })} required /></div>
              <div><label>Fecha fin</label><input type="date" value={bloqForm.fecha_fin} onChange={(e) => setBloqForm({ ...bloqForm, fecha_fin: e.target.value })} required /></div>
            </div>
            <div className="form-row">
              <div><label>Hora inicio <span style={{ color: '#94a3b8' }}>(opcional)</span></label><input type="time" value={bloqForm.hora_inicio} onChange={(e) => setBloqForm({ ...bloqForm, hora_inicio: e.target.value })} /></div>
              <div><label>Hora fin <span style={{ color: '#94a3b8' }}>(opcional)</span></label><input type="time" value={bloqForm.hora_fin} onChange={(e) => setBloqForm({ ...bloqForm, hora_fin: e.target.value })} /></div>
            </div>
            <label>Motivo (privado, solo médico/admin)</label>
            <input value={bloqForm.motivo} onChange={(e) => setBloqForm({ ...bloqForm, motivo: e.target.value })} placeholder="Ej. Capacitación ACLS" />
            <div style={{ marginTop: '0.8rem' }}><button className="btn">Crear bloqueo</button></div>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Mis horarios configurados</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Día</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {horarios.length === 0 && (
                <tr><td colSpan={6} style={{ color: '#dc2626' }}>⚠ SIN HORARIOS. Los pacientes no verán slots disponibles para ti. Crea al menos uno con el formulario.</td></tr>
              )}
              {horarios.map((h) => (
                <tr key={h.id} style={editandoId === h.id ? { background: '#fef9c3' } : {}}>
                  <td>{h.dia_display}</td>
                  <td>{h.hora_inicio}</td>
                  <td>{h.hora_fin}</td>
                  <td>{h.duracion_cita_min} min</td>
                  <td>
                    <span className={`badge ${h.activo ? 'estado-CONFIRMADA' : 'estado-CANCELADA'}`}>
                      {h.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-sec" onClick={() => editar(h)}>Editar</button>
                    <button className="btn btn-outline" onClick={() => toggleHorario(h)}>
                      {h.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="btn btn-peligro" onClick={() => eliminarHorario(h)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Mis bloqueos de agenda</h2>
        {bloqueos.length === 0
          ? <p style={{ color: '#64748b' }}>Sin bloqueos registrados.</p>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Desde</th><th>Hasta</th><th>Rango horario</th><th>Motivo (privado)</th><th>Acciones</th></tr></thead>
                <tbody>
                  {bloqueos.map((b) => (
                    <tr key={b.id}>
                      <td>{b.fecha_inicio}</td>
                      <td>{b.fecha_fin}</td>
                      <td>{b.hora_inicio ? `${b.hora_inicio} - ${b.hora_fin}` : 'Todo el día'}</td>
                      <td>{b.motivo || '—'}</td>
                      <td><button className="btn btn-peligro" onClick={() => eliminarBloqueo(b)}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}