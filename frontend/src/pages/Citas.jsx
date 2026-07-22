import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'

// RF-02: agendamiento guiado con wizard por rol + gestion de estados (Fla.B/C/D).
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const ESTADOS = ['PENDIENTE', 'CONFIRMADA', 'REPROGRAMADA', 'ATENDIDA', 'CANCELADA']
const ESTADO_COLOR = { PENDIENTE: '#d97706', CONFIRMADA: '#16a34a', REPROGRAMADA: '#7c3aed', ATENDIDA: '#0d5fa7', CANCELADA: '#dc2626' }
const ESTADO_LABEL = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', REPROGRAMADA: 'Reprogramada', ATENDIDA: 'Atendida', CANCELADA: 'Cancelada' }

// Transiciones permitidas en el backend (solo para mostrar el boton correcto)
const PUEDE = {
  PENDIENTE: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['ATENDIDA', 'CANCELADA', 'REPROGRAMADA'],
  REPROGRAMADA: ['CONFIRMADA', 'CANCELADA'],
  ATENDIDA: [],
  CANCELADA: [],
}

export default function Citas() {
  const { user } = useAuthContext()
  const [citas, setCitas] = useState([])
  const [semana, setSemana] = useState({ lunes: '', citas: [] })
  const [medicos, setMedicos] = useState([])
  const [centros, setCentros] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [vista, setVista] = useState('semana')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [miPaciente, setMiPaciente] = useState(null)
  const [reprogramando, setReprogramando] = useState(null) // cita.id

  const esPaciente = user.rol === 'PACIENTE'
  const esMedico = user.rol === 'MEDICO'
  const esAdmin = user.rol === 'ADMIN'

  const cargar = () => {
    api('/citas/?page_size=50').then((d) => setCitas(d.results || d)).catch((e) => setError(e.message))
    api('/citas/semana/').then((d) => setSemana(d)).catch(() => {})
  }

  useEffect(() => {
    cargar()
    api('/perfiles-medico/?page_size=100').then((d) => setMedicos(d.results || d)).catch(() => {})
    api('/centros/').then((d) => setCentros(d.results || d)).catch(() => {})
    api('/especialidades/').then((d) => setEspecialidades(d.results || d)).catch(() => {})
    api('/pacientes/').then((d) => {
      const m = (d.results || d)[0]
      setMiPaciente(m)
    }).catch(() => {})
  }, [])

  // ---------- Vista Semana (calendario arreglado, con cabeceras de dia y contenido) ----------
  const lun = semana.lunes ? new Date(semana.lunes + 'T00:00:00') : (() => {
    const hoy = new Date()
    return new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1)))
  })()
  const diasSemana = DIAS_CORTOS.map((d, i) => {
    const fecha = new Date(lun)
    fecha.setDate(lun.getDate() + i)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    return {
      etiqueta: d, fecha, esHoy: fecha.toDateString() === hoy.toDateString(),
      citas: (semana.citas || []).filter((c) => new Date(c.fecha_hora).toDateString() === fecha.toDateString()).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))
    }
  })

  const proximas = [...citas]
    .filter((c) => c.estado !== 'CANCELADA' && c.estado !== 'ATENDIDA' && new Date(c.fecha_hora) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))

  const stats = {
    total: citas.length,
    activas: citas.filter((c) => c.estado !== 'CANCELADA' && c.estado !== 'ATENDIDA').length,
    pendientes: citas.filter((c) => c.estado === 'PENDIENTE').length,
  }

  // ---------- Acciones de estado ----------
  const cambiarEstado = async (id, nuevoEstado) => {
    setError(''); setMsg('')
    try {
      await api(`/citas/${id}/cambiar_estado/`, { method: 'POST', body: { estado: nuevoEstado } })
      setMsg(`Cita cambiada a "${ESTADO_LABEL[nuevoEstado]}" correctamente.`)
      cargar()
    } catch (err) {
      setError(err.data?.detail || err.message)
    }
  }

  const cancelar = async (id) => {
    setError(''); setMsg('')
    if (!confirm('¿Cancelar esta cita? Solo se puede con 4+ horas de anticipación.')) return
    try {
      await api(`/citas/${id}/cancelar/`, { method: 'POST' })
      setMsg('Cita cancelada.')
      cargar()
    } catch (err) { setError(err.data?.detail || err.message) }
  }

  const guardarReprogramacion = async (id, nuevaFechaHora) => {
    setError(''); setMsg('')
    try {
      await api(`/citas/${id}/reprogramar/`, { method: 'POST', body: { fecha_hora: nuevaFechaHora } })
      setMsg('Cita reprogramada correctamente.')
      setReprogramando(null)
      cargar()
    } catch (err) { setError(err.data?.detail || err.message) }
  }

  const PuedeCancelar = (c) => (new Date(c.fecha_hora) - new Date()) / 36e5 >= 4

  // ---------- Wizard (mantenido del anterior) ----------
  const [wizard, setWizard] = useState({
    paso: 1, paciente: null, dni: '', medicoId: '', centroSaludId: '',
    fecha: '', slot: null, slots: [], ocupados: [], motivo: '', filtroEsp: '',
    cargandoPaciente: false, cargandoSlots: false, error: '', msg: '',
  })

  const abrirWizard = () => {
    setWizard({
      paso: 1, paciente: esPaciente ? miPaciente : null,
      dni: '', medicoId: esMedico ? user.id : '', centroSaludId: '',
      fecha: '', slot: null, slots: [], ocupados: [], motivo: '', filtroEsp: '',
      cargandoPaciente: false, cargandoSlots: false, error: '', msg: '',
    })
    setModalAbierto(true)
  }

  const cerrarWizard = () => { setModalAbierto(false); cargar() }

  const buscarPaciente = async () => {
    setWizard((w) => ({ ...w, cargandoPaciente: true, error: '' }))
    try {
      const d = await api(`/pacientes/?page_size=100&search=${wizard.dni}`)
      const arr = d.results || d
      if (!arr.length) {
        setWizard((w) => ({ ...w, cargandoPaciente: false, error: 'No se encontró paciente con ese DNI.' }))
        return
      }
      setWizard((w) => ({ ...w, paciente: arr[0], cargandoPaciente: false, error: '' }))
    } catch (e) {
      setWizard((w) => ({ ...w, cargandoPaciente: false, error: e.message }))
    }
  }

  const siguiente = () => {
    if (wizard.paso === 1) {
      if (esPaciente && !wizard.medicoId) return
      if (esMedico && !wizard.paciente) return
      if (esAdmin && (!wizard.paciente || !wizard.medicoId)) return
    }
    if (wizard.paso === 2 && !wizard.slot) return
    setWizard((w) => ({ ...w, paso: w.paso + 1, error: '' }))
  }
  const volver = () => setWizard((w) => ({ ...w, paso: w.paso - 1, error: '' }))

  useEffect(() => {
    if (modalAbierto && wizard.paso === 2 && wizard.medicoId && wizard.fecha) {
      setWizard((w) => ({ ...w, cargandoSlots: true, error: '' }))
      api(`/horarios/disponibilidad/?medico=${wizard.medicoId}&fecha=${wizard.fecha}`)
        .then((d) => setWizard((w) => ({ ...w, slots: d.libres || [], ocupados: d.ocupados || [], cargandoSlots: false })))
        .catch((e) => setWizard((w) => ({ ...w, cargandoSlots: false, error: e.message })))
    }
  }, [modalAbierto, wizard.paso, wizard.medicoId, wizard.fecha])

  const finalizar = async () => {
    setWizard((w) => ({ ...w, error: '', msg: '' }))
    if (!wizard.slot) { setWizard((w) => ({ ...w, error: 'Selecciona un horario disponible.' })); return }
    if (!wizard.motivo) { setWizard((w) => ({ ...w, error: 'Indica el motivo de la cita.' })); return }
    const medicoId = esMedico ? user.id : wizard.medicoId
    const body = {
      paciente: wizard.paciente.id,
      medico: medicoId,
      centro_salud: wizard.centroSaludId || wizard.paciente.centro_salud_asignado || null,
      fecha_hora: `${wizard.fecha}T${wizard.slot}:00`,
      motivo: wizard.motivo,
    }
    try {
      await api('/citas/', { method: 'POST', body })
      setWizard((w) => ({ ...w, msg: '¡Cita agendada! Se enviará recordatorio por correo antes de la fecha.' }))
      setTimeout(cerrarWizard, 1400)
    } catch (err) {
      setWizard((w) => ({ ...w, error: err.data?.fecha_hora?.[0] || err.data?.detail || err.message }))
    }
  }

  const MedicoNombre = (m) => m?.usuario_nombre ? `Dr(a). ${m.usuario_nombre} · ${m.especialidad_nombre}` : ''

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{esPaciente ? 'Mis citas' : esMedico ? 'Mi agenda de citas' : 'Citas del sistema'}</h1>
          <div className="sub">Gestión de citas con validación de disponibilidad en tiempo real y trazabilidad (creado_por).</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button className={`btn ${vista === 'semana' ? '' : 'btn-outline'}`} onClick={() => setVista('semana')}>Semana</button>
          <button className={`btn ${vista === 'lista' ? '' : 'btn-outline'}`} onClick={() => setVista('lista')}>Lista</button>
          <button className="btn btn-grande" onClick={abrirWizard}>+ Nueva cita</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Total citas</div></div>
        <div className="stat ok"><div className="num">{stats.activas}</div><div className="lbl">Activas</div></div>
        <div className="stat warn"><div className="num">{stats.pendientes}</div><div className="lbl">Pendientes de confirmar</div></div>
      </div>

      {msg && <div className="ok-banner">{msg}</div>}
      {error && <div className="alerta">{error}</div>}

      {vista === 'semana' ? (
        <div className="card">
          <h2>Calendario semanal ({lun.toLocaleDateString('es-PE')} → {diasSemana[6].fecha.toLocaleDateString('es-PE')})</h2>
          {esPaciente && <div className="info-banner">Ves únicamente TUS citas (privacidad: nunca verás a otros pacientes).</div>}
          <div className="cal-grid">
            {diasSemana.map((d) => (
              <div className="cal-dia" key={d.etiqueta} style={d.esHoy ? { borderColor: '#0d5fa7', borderWidth: 2 } : {}}>
                <div className="cal-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{d.etiqueta}</span>
                  <span style={{ color: d.esHoy ? '#0d5fa7' : '#94a3b8' }}>{d.fecha.getDate()}/{d.fecha.getMonth() + 1}</span>
                </div>
                {d.citas.length === 0 ? (
                  <div style={{ color: '#cbd5e1', fontSize: '0.72rem', padding: '4px 0' }}>Sin citas</div>
                ) : d.citas.map((c) => (
                  <div className="cal-evento" key={c.id} style={{ borderLeftColor: ESTADO_COLOR[c.estado] }}>
                    <b>{new Date(c.fecha_hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</b>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{esPaciente ? c.medico_nombre : c.paciente_nombre}</div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b' }}>{c.motivo}</div>
                    <span style={{ display: 'inline-block', marginTop: 2, fontSize: '0.6rem', padding: '1px 5px', borderRadius: 999, color: '#fff', background: ESTADO_COLOR[c.estado] }}>
                      {ESTADO_LABEL[c.estado]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Próximas citas</h2>
          {proximas.length === 0 && <p style={{ color: '#64748b' }}>No tienes citas próximas. Pulsa <b>+ Nueva cita</b> para agendar.</p>}
          {proximas.map((c) => {
            const f = new Date(c.fecha_hora)
            const reprog = reprogramando === c.id
            return (
              <div className="cita-card" key={c.id}>
                <div className="fecha">{f.getDate()}<div className="mes">{MESES[f.getMonth()]}</div></div>
                <div className="detalle">
                  <div className="t">{esPaciente ? c.medico_nombre : c.paciente_nombre}</div>
                  <div className="s">{f.toLocaleString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {c.motivo}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: '#fff', background: ESTADO_COLOR[c.estado] }}>{ESTADO_LABEL[c.estado]}</span>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Creada por {c.creado_por_username} ({c.creado_por_rol})</span>
                  </div>
                  {reprog && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ color: '#dc2626' }}>Nueva fecha y hora (formato: YYYY-MM-DDTHH:MM)</label>
                      <input type="datetime-local" id={`rep-${c.id}`} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button className="btn btn-ok" onClick={() => guardarReprogramacion(c.id, document.getElementById(`rep-${c.id}`).value.replace(' ', 'T') + ':00')}>
                          Guardar
                        </button>
                        <button className="btn btn-outline" onClick={() => setReprogramando(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
                {!reprog && PUEDE[c.estado].length > 0 && !esPaciente && (
                  <div className="acciones">
                    {PUEDE[c.estado].map((e) => {
                      const styles = {
                        CONFIRMADA: 'btn-ok', ATENDIDA: 'btn-sec',
                        CANCELADA: 'btn-peligro', REPROGRAMADA: 'btn-outline'
                      }
                      return <button key={e} className={`btn ${styles[e] || 'btn-sec'}`} onClick={() => cambiarEstado(c.id, e)}>{ESTADO_LABEL[e]}</button>
                    })}
                  </div>
                )}
                {!reprog && PUEDE[c.estado].includes('CANCELADA') && esPaciente && PuedeCancelar(c) && (
                  <div className="acciones">
                    <button className="btn btn-outline" onClick={() => setReprogramando(c.id)}>Reprogramar</button>
                    <button className="btn btn-peligro" onClick={() => cancelar(c.id)}>Cancelar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalAbierto && <WizardCita
        wizard={wizard} setWizard={setWizard}
        user={user} medicos={medicos} centros={centros} especialidades={especialidades}
        buscarPaciente={buscarPaciente} siguiente={siguiente} volver={volver} finalizar={finalizar}
        cerrar={cerrarWizard} MedicoNombre={MedicoNombre} miPaciente={miPaciente}
      />}
    </div>
  )
}

// ---------- Wizard component ----------
function WizardCita({ wizard, setWizard, user, medicos, centros, especialidades,
  buscarPaciente, siguiente, volver, finalizar, cerrar, MedicoNombre, miPaciente }) {
  const esPaciente = user.rol === 'PACIENTE'
  const esMedico = user.rol === 'MEDICO'
  const esAdmin = user.rol === 'ADMIN'
  const w = wizard
  const setW = (patch) => setWizard((prev) => ({ ...prev, ...patch }))

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Nueva cita</h2>
          <button className="modal-close" onClick={cerrar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="pasos">
            {['Médico', 'Fecha y hora', 'Confirmar'].map((_, i) => {
              const n = i + 1
              const cls = w.paso === n ? 'paso activo' : (w.paso > n ? 'paso hecho' : 'paso')
              const etiquetas = esPaciente ? ['Médico', 'Fecha y hora', 'Confirmar']
                : esMedico ? ['Paciente (DNI)', 'Fecha y hora', 'Confirmar']
                  : ['Paciente + Médico', 'Fecha y hora', 'Confirmar']
              return <div className={cls} key={n}>{n}. {etiquetas[i]}</div>
            })}
          </div>

          {w.error && <div className="alerta">{w.error}</div>}
          {w.msg && <div className="ok-banner">{w.msg}</div>}

          {/* PASO 1 */}
          {w.paso === 1 && !esPaciente && (
            <>
              <h3>Datos del paciente</h3>
              <div className="form-row" style={{ marginTop: '0.3rem' }}>
                <div>
                  <label>Buscar por DNI</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={w.dni} onChange={(e) => setW({ dni: e.target.value })}
                      placeholder="Ej. 12345678" maxLength={8} />
                    <button className="btn" onClick={buscarPaciente} disabled={w.cargandoPaciente}>
                      {w.cargandoPaciente ? '...' : 'Buscar'}
                    </button>
                  </div>
                </div>
              </div>
              {w.paciente && (
                <div className="info-grid" style={{ marginTop: 8 }}>
                  <div className="item"><div className="k">Nombre</div><div className="v">{w.paciente.nombre_completo}</div></div>
                  <div className="item"><div className="k">DNI</div><div className="v">{w.paciente.dni}</div></div>
                  <div className="item"><div className="k">Edad</div><div className="v">{w.paciente.edad} años</div></div>
                  <div className="item"><div className="k">Centro asignado</div><div className="v">{w.paciente.centro_salud_nombre || '—'}</div></div>
                  <div className="item"><div className="k">Condiciones crónicas</div><div className="v">{(w.paciente.condiciones || []).map((c) => c.nombre).join(', ') || 'Ninguna'}</div></div>
                </div>
              )}
              {esAdmin && (
                <>
                  <h3 style={{ marginTop: 14 }}>Médico responsable</h3>
                  <label>Especialidad (filtro opcional)</label>
                  <select value={w.filtroEsp || ''} onChange={(e) => setW({ filtroEsp: e.target.value, medicoId: '' })}>
                    <option value="">Todas</option>
                    {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                  <label>Médico</label>
                  <select value={w.medicoId} onChange={(e) => setW({ medicoId: e.target.value })}>
                    <option value="">— Selecciona —</option>
                    {medicos.filter((m) => !w.filtroEsp || String(m.especialidad) === String(w.filtroEsp)).map((m) => (
                      <option key={m.usuario} value={m.usuario}>{MedicoNombre(m)}</option>
                    ))}
                  </select>
                </>
              )}
              {esMedico && <div className="info-banner">Médico responsable: <b>Dr(a). {user.first_name} {user.last_name}</b> (tú).</div>}
              <label style={{ marginTop: 8 }}>Centro de salud (opcional)</label>
              <select value={w.centroSaludId} onChange={(e) => setW({ centroSaludId: e.target.value })}>
                <option value="">— Por defecto —</option>
                {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </>
          )}

          {w.paso === 1 && esPaciente && (
            <>
              <h3>Tus datos</h3>
              <div className="info-grid">
                <div className="item"><div className="k">Nombre</div><div className="v">{miPaciente?.nombre_completo || '—'}</div></div>
                <div className="item"><div className="k">DNI</div><div className="v">{miPaciente?.dni || '—'}</div></div>
                <div className="item"><div className="k">Edad</div><div className="v">{miPaciente?.edad || '—'} años</div></div>
                <div className="item"><div className="k">Centro asignado</div><div className="v">{miPaciente?.centro_salud_nombre || '—'}</div></div>
                <div className="item"><div className="k">Condiciones crónicas</div><div className="v">{(miPaciente?.condiciones || []).map((c) => c.nombre).join(', ') || 'Ninguna'}</div></div>
              </div>
              <h3 style={{ marginTop: 14 }}>Elige tu médico</h3>
              <label>Especialidad</label>
              <select value={w.filtroEsp || ''} onChange={(e) => setW({ filtroEsp: e.target.value, medicoId: '' })}>
                <option value="">Todas</option>
                {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <label>Médico</label>
              <select value={w.medicoId} onChange={(e) => setW({ medicoId: e.target.value })}>
                <option value="">— Selecciona —</option>
                {medicos.filter((m) => !w.filtroEsp || String(m.especialidad) === String(w.filtroEsp)).map((m) => (
                  <option key={m.usuario} value={m.usuario}>{MedicoNombre(m)}</option>
                ))}
              </select>
            </>
          )}

          {/* PASO 2 */}
          {w.paso === 2 && (
            <>
              <h3>Selecciona fecha y hora</h3>
              <div className="info-banner" style={{ marginTop: 6 }}>
                Reglas: solo fechas futuras (mín. 2 h de anticipación). Solo eliges slots libres
                (el sistema cruza <b>horario base + citas ya tomadas + bloqueos del médico</b>).
              </div>
              <label>Fecha</label>
              <input type="date" value={w.fecha} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setW({ fecha: e.target.value, slot: null, slots: [], ocupados: [] })} required />
              {!w.fecha && <div className="hint">Selecciona una fecha para ver los horarios disponibles.</div>}
              {w.fecha && w.cargandoSlots && <div className="hint">Cargando disponibilidad…</div>}
              {w.fecha && !w.cargandoSlots && (
                <>
                  <h3 style={{ marginTop: 12 }}>
                    Horarios disponibles ({w.slots.length})
                    {w.slots.length === 0 && <span style={{ color: '#dc2626' }}> — No hay slots este día (el médico no atiende o está bloqueado).</span>}
                  </h3>
                  {w.slots.length > 0 && (
                    <div className="slots-grid">
                      {w.slots.sort().map((s) => {
                        const sel = w.slot === s
                        return (
                          <div key={s} className={`slot libre ${sel ? 'seleccionado' : ''}`}
                            onClick={() => setW({ slot: sel ? null : s })} title="Disponible">
                            {s}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {w.slot && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ color: '#16a34a' }}>Elegido: {w.slot}</b>
                      <button className="btn btn-sec" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setW({ slot: null })}>Borrar selección</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* PASO 3 */}
          {w.paso === 3 && (
            <>
              <h3>Resumen y motivo</h3>
              <div className="info-grid">
                <div className="item"><div className="k">Paciente</div><div className="v">{w.paciente?.nombre_completo || miPaciente?.nombre_completo}</div></div>
                <div className="item"><div className="k">DNI</div><div className="v">{w.paciente?.dni || miPaciente?.dni}</div></div>
                <div className="item"><div className="k">Fecha y hora</div><div className="v">{w.fecha} · {w.slot}</div></div>
                <div className="item"><div className="k">Médico</div><div className="v">{esMedico ? `Dr(a). ${user.first_name} ${user.last_name}` : MedicoNombre(medicos.find((m) => String(m.usuario) === String(w.medicoId)) || {})}</div></div>
              </div>
              <label>Motivo de la cita</label>
              <textarea rows="3" value={w.motivo} onChange={(e) => setW({ motivo: e.target.value })} required />
              <div className="info-banner" style={{ marginTop: 8 }}>Se registrará con <b>creado_por = {user.rol}</b> para trazabilidad (LogAuditoria).</div>
            </>
          )}
        </div>

        {w.msg ? null : (
          <div className="modal-foot">
            <div>{w.paso > 1 && <button className="btn btn-outline" onClick={volver}>← Atrás</button>}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {w.paso < 3 && <button className="btn" onClick={siguiente} disabled={!puedeSiguiente(w, user)}>Siguiente →</button>}
              {w.paso === 3 && <button className="btn btn-ok" onClick={finalizar} disabled={!w.slot || !w.motivo}>Confirmar cita</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function puedeSiguiente(w, user) {
  if (w.paso === 1) {
    if (user.rol === 'PACIENTE') return !!w.medicoId
    if (user.rol === 'MEDICO') return !!w.paciente
    return !!w.paciente && !!w.medicoId
  }
  if (w.paso === 2) return !!w.slot
  return true
}