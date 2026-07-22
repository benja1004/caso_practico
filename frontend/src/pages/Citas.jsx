import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'

// RF-02: agendamiento guiado con wizard por rol.
//   - Paciente: autocompleta SUS datos, elige médico + fecha + slot.
//   - Médico: busca paciente por DNI (carga sus datos), él es el médico.
//   - Admin: busca paciente por DNI + elige médico.
// Disponibilidad real del HorarioMedico + Cita + BloqueoAgenda.
// Restricciones visibles y slot borrable (deseleccionable).
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function Citas() {
  const { user } = useAuthContext()
  const [citas, setCitas] = useState([])
  const [semana, setSemana] = useState({ lunes: '', citas: [] })
  const [pacientes, setPacientes] = useState([])
  const [medicos, setMedicos] = useState([])
  const [centros, setCentros] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [vista, setVista] = useState('semana')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [miPaciente, setMiPaciente] = useState(null)

  const esPaciente = user.rol === 'PACIENTE'
  const esMedico = user.rol === 'MEDICO'
  const esAdmin = user.rol === 'ADMIN'

  const cargar = () => {
    api('/citas/?page_size=50').then((d) => setCitas(d.results || d)).catch((e) => setError(e.message))
    api('/citas/semana/').then((d) => setSemana(d)).catch(() => {})
  }

  useEffect(() => {
    cargar()
    api('/perfiles-medico/?page_size=100').then((d) => {
      const lista = d.results || d
      // Junta perfil con nombre compuesto
      setMedicos(lista)
    }).catch(() => {})
    api('/centros/').then((d) => setCentros(d.results || d)).catch(() => {})
    api('/especialidades/').then((d) => setEspecialidades(d.results || d)).catch(() => {})
    if (esPaciente) {
      // Trae MIS datos (autogenerados en el wizard)
      api('/pacientes/').then((d) => {
        const m = (d.results || d)[0]
        setMiPaciente(m)
      }).catch(() => {})
    }
  }, [])

  // ---- Vista Semana (calendario) ----
  const lun = semana.lunes ? new Date(semana.lunes) : new Date()
  const diasSemana = DIAS.map((d, i) => {
    const fecha = new Date(lun)
    fecha.setDate(lun.getDate() + i)
    return {
      etiqueta: d, fecha,
      citas: (semana.citas || []).filter((c) =>
        new Date(c.fecha_hora).toDateString() === fecha.toDateString())
    }
  })

  // Agrupa próximas citas ordenadas
  const proximas = [...citas]
    .filter((c) => new Date(c.fecha_hora) >= new Date())
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora))

  const stats = {
    total: citas.length,
    activas: citas.filter((c) => c.estado !== 'CANCELADA').length,
    pendientes:
      citas.filter((c) => c.estado === 'PENDIENTE' || c.estado === 'CONFIRMADA').length,
  }

  const accion = async (id, op, body) => {
    setError(''); setMsg('')
    try {
      await api(`/citas/${id}/${op}/`, { method: 'POST', body })
      setMsg(op === 'cancelar' ? 'Cita cancelada.' : 'Cita reprogramada.')
      cargar()
    } catch (err) { setError(err.data?.detail || err.message) }
  }

  const reprogramar = (id) => {
    const nueva = prompt('Nueva fecha y hora (YYYY-MM-DDTHH:MM):')
    if (nueva) accion(id, 'reprogramar', { fecha_hora: nueva })
  }

  const fmtFecha = (iso) => new Date(iso)
  const PuedeCancelar = (c) => (new Date(c.fecha_hora) - new Date()) / 36e5 >= 4

  // ---- Botón "Nueva Cita" ----
  const [wizard, setWizard] = useState({
    paso: 1,
    paciente: null,        // objeto paciente
    dni: '',               // input de búsqueda
    medicoId: '',          // médico elegido
    centroSaludId: '',
    fecha: '',             // YYYY-MM-DD
    slot: null,            // HH:MM
    slots: [],             // lista de libres
    ocupados: [],          // lista de ocupados
    motivo: '',
    cargandoPaciente: false,
    cargandoSlots: false,
    error: '', msg: '',
  })

  const abrirWizard = () => {
    setWizard({
      paso: 1, paciente: esPaciente ? miPaciente : null,
      dni: '', medicoId: esMedico ? user.id : '', centroSaludId: '',
      fecha: '', slot: null, slots: [], ocupados: [], motivo: '',
      cargandoPaciente: false, cargandoSlots: false, error: '', msg: '',
    })
    setModalAbierto(true)
  }

  const cerrarWizard = () => { setModalAbierto(false); cargar() }

  // Paso 1/2 según rol: médico/admin buscan DNI; paciente ya tiene sus datos.
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
    if (esPaciente) {
      // paciente: paso 1 = elegir médico → 2 fecha+slot → 3 motivo
      if (wizard.paso === 1 && !wizard.medicoId) return
    } else {
      // medico/admin: paso 1 = buscar paciente (y medico si admin) → 2 fecha+slot → 3 motivo
      if (wizard.paso === 1 && (!wizard.paciente || (esAdmin && !wizard.medicoId))) return
    }
    setWizard((w) => ({ ...w, paso: w.paso + 1 }))
  }

  const volver = () => setWizard((w) => ({ ...w, paso: w.paso - 1, msg: '', error: '' }))

  // Paso 2: cargar slots cuando hay médico + fecha
  useEffect(() => {
    const medicoId = wizard.medicoId
    if (modalAbierto && wizard.paso === 2 && medicoId && wizard.fecha) {
      setWizard((w) => ({ ...w, cargandoSlots: true, error: '' }))
      api(`/horarios/disponibilidad/?medico=${medicoId}&fecha=${wizard.fecha}`)
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
      centro_salud: wizard.centroSaludId || (wizard.paciente.centro_salud_asignado) || null,
      fecha_hora: `${wizard.fecha}T${wizard.slot}:00`,
      motivo: wizard.motivo,
    }
    try {
      await api('/citas/', { method: 'POST', body })
      setWizard((w) => ({ ...w, msg: '¡Cita agendada! Se enviará recordatorio por correo antes de la fecha.' }))
      setTimeout(() => cerrarWizard(), 1400)
    } catch (err) {
      setWizard((w) => ({ ...w, error: err.data?.fecha_hora?.[0] || err.data?.detail || err.message }))
    }
  }

  const MedicoNombre = (m) => `Dr(a). ${m.usuario_nombre} · ${m.especialidad_nombre}`

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>
            {esPaciente ? 'Mis citas' : esMedico ? 'Mi agenda de citas' : 'Citas del sistema'}
          </h1>
          <div className="sub">Gestión de citas con validación de disponibilidad en tiempo real.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => setVista('semana')}>Semana</button>
          <button className="btn btn-outline" onClick={() => setVista('lista')}>Lista</button>
          <button className="btn btn-grande" onClick={abrirWizard}>+ Nueva cita</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Total citas</div></div>
        <div className="stat ok"><div className="num">{stats.activas}</div><div className="lbl">Activas</div></div>
        <div className="stat warn"><div className="num">{stats.pendientes}</div><div className="lbl">Pendientes / confirmadas</div></div>
      </div>

      {msg && <div className="ok-banner">{msg}</div>}
      {error && <div className="alerta">{error}</div>}

      {vista === 'semana' ? (
        <div className="card">
          <h2>Calendario semanal</h2>
          {esPaciente && <div className="info-banner">Ves únicamente TUS citas (privacidad: nunca verás a otros pacientes).</div>}
          <div className="cal-grid">
            {diasSemana.map((d) => (
              <div className="cal-dia" key={d.etiqueta}>
                <div className="cal-head">{d.etiqueta} {d.fecha.getDate()}</div>
                {d.citas.length === 0
                  ? <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>— Sin citas —</div>
                  : d.citas.map((c) => (
                    <div className="cal-evento" key={c.id}>
                      <b>{new Date(c.fecha_hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</b>
                      <div style={{ fontSize: '0.7rem' }}>{esPaciente ? c.medico_nombre : c.paciente_nombre}</div>
                      <span className={`badge estado-${c.estado}`} style={{ fontSize: '0.62rem' }}>{c.estado}</span>
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
            return (
              <div className="cita-card" key={c.id}>
                <div className="fecha">{f.getDate()}<div className="mes">{MESES[f.getMonth()]}</div></div>
                <div className="detalle">
                  <div className="t">{esPaciente ? c.medico_nombre : c.paciente_nombre}</div>
                  <div className="s">{f.toLocaleString('es-PE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {c.motivo}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge estado-${c.estado}`}>{c.estado}</span>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Creada por {c.creado_por_username} ({c.creado_por_rol})</span>
                  </div>
                </div>
                {PuedeCancelar(c) && (
                  <div className="acciones">
                    <button className="btn btn-sec" onClick={() => reprogramar(c.id)}>Reprogramar</button>
                    <button className="btn btn-peligro" onClick={() => accion(c.id, 'cancelar')}>Cancelar</button>
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

  // Filtra médicos por especialidad si el paciente eligió una
  const medicosFiltrados = medicos

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
              const etiquetas = esPaciente
                ? ['Médico', 'Fecha y hora', 'Confirmar']
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
                  <select value={w.filtroEsp || ''} onChange={(e) => setW({ filtroEsp: e.target.value })}>
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
              <select value={w.filtroEsp || ''} onChange={(e) => setW({ filtroEsp: e.target.value })}>
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

          {/* PASO 2 - fecha y slots */}
          {w.paso === 2 && (
            <>
              <h3>Selecciona fecha y hora</h3>
              <div className="info-banner" style={{ marginTop: 6 }}>
                Reglas: solo fechas futuras, mínimo 2h de anticipación. Solo eliges slots libres
                (el sistema cruza horario base + citas ya tomadas + bloqueos del médico).
                <ul className="lista-restricciones" style={{ marginTop: 6 }}>
                  <li>Si no ves slots: el médico no tiene horario ese día o está bloqueado.</li>
                  <li>Los horarios ocupados se muestran tachados (sin nombres de otros pacientes).</li>
                </ul>
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
                    {w.slot && <span style={{ fontWeight: 400, color: '#16a34a' }}> · Elegido: {w.slot}</span>}
                    {w.slot && <button className="btn btn-sec" style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setW({ slot: null })}>Borrar selección</button>}
                  </h3>
                  <div className="slots-grid">
                    {[...w.slots, ...w.ocupados].sort().map((s) => {
                      const libre = w.slots.includes(s)
                      const sel = w.slot === s
                      return (
                        <div key={s}
                          className={`slot ${libre ? 'libre' : 'ocupado'} ${sel ? 'seleccionado' : ''}`}
                          onClick={() => libre && setW({ slot: sel ? null : s })}
                          title={libre ? 'Disponible' : 'Ocupado (cita o bloqueo del médico)'}>
                          {s}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* PASO 3 - motivo + confirmar */}
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
            <div>
              {w.paso > 1 && <button className="btn btn-outline" onClick={volver}>← Atrás</button>}
            </div>
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