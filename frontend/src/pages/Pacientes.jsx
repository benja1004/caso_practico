/**
 * Pacientes.jsx — Módulo NAVARRO
 * Gestión de pacientes + condiciones crónicas + historial consolidado + legacy staging
 * Rama: feature/navarro
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '../context/AuthContext'
import { api } from '../services/api'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const CONDICION_COLOR = {
  DIABETES:     { bg: '#fef3c7', color: '#92400e', emoji: '🩸' },
  HIPERTENSION: { bg: '#fee2e2', color: '#991b1b', emoji: '❤️' },
  EPOC:         { bg: '#ede9fe', color: '#5b21b6', emoji: '🫁' },
}

function getBadgeCondicion(codigo) {
  const c = CONDICION_COLOR[codigo] || { bg: '#f1f5f9', color: '#334155', emoji: '🏥' }
  return (
    <span
      key={codigo}
      style={{
        background: c.bg, color: c.color,
        padding: '0.15rem 0.55rem', borderRadius: 999,
        fontSize: '0.72rem', fontWeight: 700, display: 'inline-block', marginRight: 4
      }}
    >
      {c.emoji} {codigo}
    </span>
  )
}

// ──────────────────────────────────────────────
// Modal: Historial Consolidado del Paciente
// ──────────────────────────────────────────────
function ModalHistorial({ paciente, onClose }) {
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    api(`/pacientes/${paciente.id}/historial/`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [paciente.id])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🗂️ Historial — {paciente.nombre_completo}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {cargando && <p style={{ color: 'var(--gris)' }}>Cargando historial…</p>}
          {error && <div className="alerta">{error}</div>}
          {data && (
            <>
              {/* Datos del paciente */}
              <div className="info-grid" style={{ marginBottom: '1rem' }}>
                <div className="item"><div className="k">DNI</div><div className="v">{data.paciente.dni || '—'}</div></div>
                <div className="item"><div className="k">Edad</div><div className="v">{data.paciente.edad} años</div></div>
                <div className="item"><div className="k">Teléfono</div><div className="v">{data.paciente.telefono || '—'}</div></div>
                <div className="item"><div className="k">Centro</div><div className="v">{data.paciente.centro_salud_nombre || '—'}</div></div>
                <div className="item">
                  <div className="k">Contacto emergencia</div>
                  <div className="v">{data.paciente.contacto_emergencia || '—'}</div>
                </div>
                <div className="item">
                  <div className="k">Condiciones</div>
                  <div className="v">
                    {data.paciente.condiciones?.length
                      ? data.paciente.condiciones.map(c => getBadgeCondicion(c.codigo))
                      : <span style={{ color: 'var(--gris)', fontSize: '0.85rem' }}>Ninguna registrada</span>}
                  </div>
                </div>
              </div>

              {/* Últimas citas */}
              <h3 style={{ color: 'var(--azul-2)', marginBottom: '0.5rem' }}>📅 Últimas 10 citas</h3>
              {data.citas.length === 0
                ? <p style={{ color: 'var(--gris)', fontSize: '0.85rem', marginBottom: '1rem' }}>Sin citas registradas.</p>
                : (
                  <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Médico</th>
                          <th>Estado</th>
                          <th>Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.citas.map(c => (
                          <tr key={c.id}>
                            <td>{new Date(c.fecha_hora).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>{c.medico_nombre || c.medico}</td>
                            <td><span className={`badge estado-${c.estado}`}>{c.estado}</span></td>
                            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Últimos signos */}
              <h3 style={{ color: 'var(--azul-2)', marginBottom: '0.5rem' }}>🩺 Últimos 20 signos vitales</h3>
              {data.signos.length === 0
                ? <p style={{ color: 'var(--gris)', fontSize: '0.85rem' }}>Sin signos registrados.</p>
                : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Valor</th>
                          <th>Unidad</th>
                          <th>Alerta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.signos.map(s => (
                          <tr key={s.id}>
                            <td>{new Date(s.registrado_en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>{s.tipo}</td>
                            <td style={{ fontWeight: 700, color: s.en_alerta ? 'var(--rojo)' : 'inherit' }}>
                              {s.tipo === 'PRESION'
                                ? `${s.valor_sistolica}/${s.valor_diastolica}`
                                : s.valor}
                            </td>
                            <td>{s.unidad}</td>
                            <td>
                              {s.en_alerta
                                ? <span className={`badge estado-${s.nivel_alerta}`}>{s.nivel_alerta}</span>
                                : <span className="badge estado-TRUE">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Links HATEOAS */}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href={data.paciente.links?.citas} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sec" style={{ fontSize: '0.82rem' }}>📅 Ver todas las citas</button>
                </a>
                <a href={data.paciente.links?.signos} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sec" style={{ fontSize: '0.82rem' }}>🩺 Ver signos</button>
                </a>
                <a href={data.paciente.links?.tendencias} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-sec" style={{ fontSize: '0.82rem' }}>📈 Tendencias</button>
                </a>
              </div>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Modal: Asignar Condición Crónica
// ──────────────────────────────────────────────
function ModalCondicion({ paciente, condiciones, onClose, onSaved }) {
  const [form, setForm] = useState({ condicion: '', fecha_diagnostico: '' })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api('/paciente-condiciones/', {
        method: 'POST',
        body: { paciente: paciente.id, ...form }
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🩺 Asignar condición a {paciente.nombre_completo}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alerta">{error}</div>}
            <label htmlFor="select-condicion">Condición crónica</label>
            <select
              id="select-condicion"
              value={form.condicion}
              onChange={e => setForm({ ...form, condicion: e.target.value })}
              required
            >
              <option value="">— Seleccionar —</option>
              {condiciones.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
            <label htmlFor="fecha-diag">Fecha de diagnóstico</label>
            <input
              id="fecha-diag"
              type="date"
              value={form.fecha_diagnostico}
              onChange={e => setForm({ ...form, fecha_diagnostico: e.target.value })}
              required
            />
            <div className="hint">
              💡 Esta asignación es clave: los rangos de glucosa varían si el paciente es diabético (Compañero 4 — Monitoreo).
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn" disabled={cargando}>
              {cargando ? 'Guardando…' : '✅ Asignar condición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Panel: Legacy Staging (solo ADMIN)
// ──────────────────────────────────────────────
function PanelLegacy({ onPacienteCreado }) {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  // Para importar manualmente (demo JSP)
  const [jsonImport, setJsonImport] = useState('')

  const cargar = useCallback(() => {
    setCargando(true)
    api('/legacy/')
      .then(d => setRegistros(d.results || d))
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const validar = async (id, accion) => {
    setError(''); setExito('')
    try {
      const d = await api('/legacy/validar/', {
        method: 'POST',
        body: { registro_id: id, accion }
      })
      setExito(d.detail)
      cargar()
      if (accion === 'crear_paciente') onPacienteCreado?.()
    } catch (e) {
      setError(e.message)
    }
  }

  const importar = async () => {
    setError(''); setExito('')
    try {
      const registrosJSON = JSON.parse(jsonImport)
      const payload = Array.isArray(registrosJSON) ? registrosJSON : [registrosJSON]
      const d = await api('/legacy/importar/', {
        method: 'POST',
        body: { registros: payload }
      })
      setExito(`Importados ${d.importados_a_staging} registro(s) a staging.`)
      setJsonImport('')
      cargar()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="card">
      <h2>🗄️ Módulo Legacy — Staging del JSP</h2>
      <p style={{ color: 'var(--gris)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
        El módulo JSP (<code>patient-sync.jsp</code>) publica filas CSV en <code>/legacy/importar/</code>.
        Aquí validas o rechazas cada registro antes de crear el paciente vinculado.
        <strong> Nunca confiamos en datos externos sin validación.</strong>
      </p>

      {/* Importar manualmente para demo */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--borde)', borderRadius: 10, padding: '0.8rem', marginBottom: '1rem' }}>
        <label htmlFor="json-import">📤 Simular envío del JSP (JSON)</label>
        <textarea
          id="json-import"
          rows={3}
          placeholder={'[{"dni":"12345678","nombres":"Juan","apellidos":"Perez","fecha_nacimiento":"1990-01-01"}]'}
          value={jsonImport}
          onChange={e => setJsonImport(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}
        />
        <button className="btn" style={{ fontSize: '0.82rem' }} onClick={importar} disabled={!jsonImport.trim()}>
          📥 Importar a staging
        </button>
      </div>

      {error && <div className="alerta">{error}</div>}
      {exito && <div className="ok-banner">✅ {exito}</div>}

      {cargando
        ? <p style={{ color: 'var(--gris)' }}>Cargando registros legacy…</p>
        : registros.length === 0
          ? <p style={{ color: 'var(--gris)', fontSize: '0.9rem' }}>No hay registros pendientes en staging.</p>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Legacy</th>
                    <th>Datos CSV</th>
                    <th>Importado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td><code style={{ fontSize: '0.8rem' }}>{r.paciente_legacy_id}</code></td>
                      <td style={{ maxWidth: 220 }}>
                        <pre style={{
                          margin: 0, fontSize: '0.72rem', whiteSpace: 'pre-wrap',
                          background: '#f1f5f9', borderRadius: 6, padding: '0.3rem 0.5rem'
                        }}>
                          {JSON.stringify(r.datos_csv, null, 2).slice(0, 180)}
                          {JSON.stringify(r.datos_csv).length > 180 ? '…' : ''}
                        </pre>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(r.migrado_en).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        {r.validado
                          ? <span className="badge estado-CONFIRMADA">Validado</span>
                          : <span className="badge estado-PENDIENTE">Pendiente</span>}
                      </td>
                      <td>
                        {!r.validado && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-ok"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                              onClick={() => validar(r.id, 'crear_paciente')}
                            >
                              ✅ Crear paciente
                            </button>
                            <button
                              className="btn btn-peligro"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                              onClick={() => validar(r.id, 'rechazar')}
                            >
                              ❌ Rechazar
                            </button>
                          </div>
                        )}
                        {r.validado && r.paciente_vinculado && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--verde)' }}>
                            Pac. #{r.paciente_vinculado}
                          </span>
                        )}
                        {r.validado && !r.paciente_vinculado && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--gris)' }}>Rechazado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Componente principal: Pacientes
// ──────────────────────────────────────────────
export default function Pacientes() {
  const { user } = useAuthContext()
  const esAdmin = user?.rol === 'ADMIN'
  const esMedico = user?.rol === 'MEDICO'
  const esPaciente = user?.rol === 'PACIENTE'

  const [pacientes, setPacientes] = useState([])
  const [condiciones, setCondiciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCond, setFiltroCond] = useState('')

  // Modales
  const [verHistorial, setVerHistorial] = useState(null)    // paciente
  const [asignarCond, setAsignarCond] = useState(null)      // paciente

  // Stats
  const [stats, setStats] = useState({ total: 0, con_condicion: 0, centros: 0 })

  const cargarPacientes = useCallback(async () => {
    setCargando(true); setError('')
    try {
      let url = '/pacientes/?'
      if (busqueda) url += `search=${encodeURIComponent(busqueda)}&`
      if (filtroCond) url += `condiciones__codigo=${encodeURIComponent(filtroCond)}&`
      const d = await api(url)
      const lista = d.results || d
      setPacientes(lista)
      setStats({
        total: lista.length,
        con_condicion: lista.filter(p => p.condiciones?.length > 0).length,
        centros: new Set(lista.map(p => p.centro_salud_asignado).filter(Boolean)).size,
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [busqueda, filtroCond])

  useEffect(() => {
    api('/condiciones/').then(d => setCondiciones(d.results || d)).catch(() => {})
  }, [])

  useEffect(() => { cargarPacientes() }, [cargarPacientes])

  return (
    <div>
      {/* Hero header */}
      <div style={{
        background: 'linear-gradient(120deg, var(--azul-2), var(--azul))',
        color: '#fff',
        borderRadius: 16,
        padding: '1.6rem',
        marginBottom: '1.2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)', display: 'grid',
            placeItems: 'center', fontSize: '1.8rem'
          }}>👥</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem' }}>Gestión de Pacientes</h1>
            <div style={{ color: '#bae6fd', fontSize: '0.95rem' }}>
              Módulo NAVARRO — Pacientes + condiciones crónicas + legacy staging
            </div>
          </div>
        </div>
        {/* Stats */}
        {!esPaciente && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.8rem', marginTop: '1rem'
          }}>
            {[
              { n: stats.total, l: 'Pacientes' },
              { n: stats.con_condicion, l: 'Con condición crónica' },
              { n: stats.centros, l: 'Centros de salud' },
              { n: condiciones.length, l: 'Condiciones en catálogo' },
            ].map(s => (
              <div key={s.l} style={{
                background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                padding: '0.7rem 0.9rem'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtros (médico/admin) */}
      {!esPaciente && (
        <div className="card" style={{ padding: '0.9rem' }}>
          <div className="form-row">
            <div>
              <label htmlFor="busqueda-pac">🔍 Buscar (nombre, DNI, usuario)</label>
              <input
                id="busqueda-pac"
                type="search"
                placeholder="Ej. López, 12345678…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filtro-cond">🩺 Filtrar por condición crónica</label>
              <select
                id="filtro-cond"
                value={filtroCond}
                onChange={e => setFiltroCond(e.target.value)}
              >
                <option value="">— Todas —</option>
                {condiciones.map(c => (
                  <option key={c.id} value={c.codigo}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn" onClick={cargarPacientes}>🔄 Aplicar filtros</button>
            </div>
          </div>
          <div className="info-banner" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            💡 Filtrar por condición crónica permite al Compañero 4 (Monitoreo) ver qué rangos
            de glucosa aplican: diabéticos tienen rango 80-180 mg/dL vs. 70-140 normal.
          </div>
        </div>
      )}

      {error && <div className="alerta">{error}</div>}

      {/* Tabla de pacientes */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>
            {esPaciente ? '👤 Mi perfil de paciente' : `📋 Lista de pacientes (${pacientes.length})`}
          </h2>
        </div>

        {cargando
          ? <p style={{ color: 'var(--gris)' }}>Cargando pacientes…</p>
          : pacientes.length === 0
            ? <p style={{ color: 'var(--gris)' }}>No se encontraron pacientes con los filtros aplicados.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>DNI</th>
                      <th>Edad</th>
                      <th>Condiciones crónicas</th>
                      <th>Centro de salud</th>
                      {!esPaciente && <th>Citas</th>}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientes.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--azul-2)' }}>{p.nombre_completo}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--gris)' }}>@{p.username}</div>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.85rem' }}>{p.dni || '—'}</code>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.edad} años</td>
                        <td>
                          {p.condiciones?.length
                            ? p.condiciones.map(c => getBadgeCondicion(c.codigo))
                            : <span style={{ color: 'var(--gris-2)', fontSize: '0.8rem' }}>Ninguna</span>}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{p.centro_salud_nombre || '—'}</td>
                        {!esPaciente && (
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {p.total_citas ?? 0}
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {/* Ver historial */}
                            <button
                              className="btn"
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                              onClick={() => setVerHistorial(p)}
                              title="Ver historial consolidado"
                            >
                              🗂️ Historial
                            </button>
                            {/* Asignar condición (médico/admin) */}
                            {(esMedico || esAdmin) && (
                              <button
                                className="btn btn-sec"
                                style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                                onClick={() => setAsignarCond(p)}
                                title="Asignar condición crónica"
                              >
                                🩺 Condición
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      {/* Catálogo de condiciones */}
      <div className="card">
        <h2>📚 Catálogo de condiciones crónicas</h2>
        <p style={{ color: 'var(--gris)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
          Los rangos clínicos de glucosa varían según la condición del paciente
          (clave para el módulo de Monitoreo — Compañero 4).
        </p>
        {condiciones.length === 0
          ? <p style={{ color: 'var(--gris)' }}>Sin condiciones registradas.</p>
          : (
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              {condiciones.map(c => {
                const meta = CONDICION_COLOR[c.codigo] || { bg: '#f1f5f9', color: '#334155', emoji: '🏥' }
                return (
                  <div key={c.id} style={{
                    background: meta.bg, color: meta.color,
                    borderRadius: 12, padding: '0.8rem 1.2rem',
                    fontWeight: 700, fontSize: '1rem',
                    border: `1px solid ${meta.color}22`
                  }}>
                    <div style={{ fontSize: '1.5rem' }}>{meta.emoji}</div>
                    <div>{c.nombre}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.78rem' }}>código: {c.codigo}</div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* Panel legacy solo para admin */}
      {esAdmin && (
        <PanelLegacy onPacienteCreado={cargarPacientes} />
      )}

      {/* Nota de diseño para compañeros */}
      <div className="hint">
        <strong>🔗 Integración entre módulos:</strong><br />
        • <strong>Monitoreo (C4)</strong>: usa <code>/pacientes/&#123;id&#125;/historial/</code> para
          mostrar citas y signos consolidados.<br />
        • <strong>Agenda (C3)</strong>: busca pacientes con <code>/pacientes/?search=DNI</code>.<br />
        • <strong>Prescripciones (C5)</strong>: las recetas se vinculan al <code>Paciente.id</code>.<br />
        • <strong>Admin (C6)</strong>: el legacy staging requiere rol <code>ADMIN</code> para validar.
      </div>

      {/* Modales */}
      {verHistorial && (
        <ModalHistorial
          paciente={verHistorial}
          onClose={() => setVerHistorial(null)}
        />
      )}
      {asignarCond && (
        <ModalCondicion
          paciente={asignarCond}
          condiciones={condiciones}
          onClose={() => setAsignarCond(null)}
          onSaved={cargarPacientes}
        />
      )}
    </div>
  )
}
