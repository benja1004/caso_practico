import { useEffect, useState } from 'react'
import { api } from '../services/api'

// RF-07: panel administrativo - usuarios, auditoria inmutable, respaldo
// + RF-09: validacion de registros legacy importados desde el modulo JSP
export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [logs, setLogs] = useState([])
  const [legacy, setLegacy] = useState([])
  const [centros, setCentros] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [form, setForm] = useState({
    rol: 'PACIENTE', username: '', password: '', first_name: '', last_name: '',
    email: '', dni: '', telefono: '',
    fecha_nacimiento: '', direccion: '', contacto_emergencia: '', centro_salud_asignado: '',
    especialidad: '', centro_salud: '', numero_colegiatura: '',
  })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [filtroLog, setFiltroLog] = useState('CAMBIOS')

  const cargar = () => {
    api('/auth/usuarios/?page_size=100').then((d) => setUsuarios(d.results || d)).catch((e) => setError(e.message))
    api('/admin-panel/auditoria/?page_size=100').then((d) => setLogs(d.results || d)).catch((e) => setError(e.message))
    api('/legacy/?page_size=30').then((d) => setLegacy(d.results || d)).catch((e) => setError(e.message))
    api('/centros/').then((d) => setCentros(d.results || d)).catch(() => {})
    api('/especialidades/').then((d) => setEspecialidades(d.results || d)).catch(() => {})
  }
  useEffect(cargar, [])

  const LOG_FILTROS = {
    CAMBIOS: ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'POST', 'PUT', 'PATCH'],
    POST: ['POST'],
    CREATES: ['CREATE'],
    TODO: null,
  }
  const logsFiltrados = LOG_FILTROS[filtroLog]
    ? logs.filter((l) => LOG_FILTROS[filtroLog].includes(l.accion))
    : logs

  const limpiarForm = (rol) => ({
    rol, username: '', password: '', first_name: '', last_name: '',
    email: '', dni: '', telefono: '',
    fecha_nacimiento: '', direccion: '', contacto_emergencia: '', centro_salud_asignado: '',
    especialidad: '', centro_salud: '', numero_colegiatura: '',
  })

  const setRol = (rol) => { setForm(limpiarForm(rol)); setMsg(''); setError('') }

  const crearUsuario = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const body = { ...form }
      if (form.rol !== 'PACIENTE') { delete body.fecha_nacimiento; delete body.direccion; delete body.contacto_emergencia; delete body.centro_salud_asignado }
      if (form.rol !== 'MEDICO') { delete body.especialidad; delete body.centro_salud; delete body.numero_colegiatura }
      await api('/auth/usuarios/', { method: 'POST', body })
      setMsg(`Usuario ${form.username} creado correctamente.`)
      setForm(limpiarForm(form.rol))
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const respaldo = async () => {
    const r = await api('/admin-panel/auditoria/respaldo/', { method: 'POST' })
    setMsg(`${r.detail} ${JSON.stringify(r.resumen)}`)
  }

  const simularImportLegacy = async () => {
    await api('/legacy/importar/', { method: 'POST', body: { registros: [
      { dni: '99900011', nombres: 'Importado', apellidos: 'Demo JSP', fecha_nacimiento: '1990-02-15', sexo: 'F', condicion: 'DIABETES' },
      { dni: '99900022', nombres: 'Otro', apellidos: 'Historial', fecha_nacimiento: '1975-08-03', sexo: 'M', condicion: 'HIPERTENSION' },
    ] } })
    setMsg('Import JSP simulado: 2 registros en staging pendientes de validacion.')
    cargar()
  }

  const validarLegacy = async (id, accion) => {
    const r = await api('/legacy/validar/', { method: 'POST', body: { registro_id: id, accion } })
    setMsg(r.detail)
    cargar()
  }

  const ROL_INFO = {
    PACIENTE: { color: '#0d5fa7', icon: '🧑', label: 'Paciente', bg: '#eff6ff' },
    MEDICO: { color: '#16a34a', icon: '⚕️', label: 'Médico', bg: '#f0fdf4' },
    ADMIN: { color: '#7c3aed', icon: '⚙️', label: 'Administrador', bg: '#f5f3ff' },
  }
  const ri = ROL_INFO[form.rol]

  return (
    <div>
      <div className="grid-wide">
        <div className="card card-full" style={{ padding: '1.8rem', background: ri.bg, border: `2px solid ${ri.color}` }}>
          <h2 style={{ marginBottom: '0.8rem' }}>Crear usuario</h2>

          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.2rem' }}>
            {Object.entries(ROL_INFO).map(([key, v]) => (
              <button key={key} type="button"
                onClick={() => setRol(key)}
                style={{
                  flex: 1, padding: '0.8rem 1rem', borderRadius: 12, cursor: 'pointer',
                  border: form.rol === key ? `2px solid ${v.color}` : '2px solid #e2e8f0',
                  background: form.rol === key ? v.color : '#fff',
                  color: form.rol === key ? '#fff' : '#334155',
                  fontSize: '1rem', fontWeight: 700, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <span style={{ fontSize: '1.3rem' }}>{v.icon}</span> {v.label}
              </button>
            ))}
          </div>

          <form onSubmit={crearUsuario}>
            <div className="form-row">
              <div><label>Usuario *</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required style={{ width: '100%' }} /></div>
              <div><label>Contraseña * (mín 8)</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} style={{ width: '100%' }} /></div>
            </div>
            <div className="form-row">
              <div><label>Nombres</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Apellidos</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={{ width: '100%' }} /></div>
            </div>
            <div className="form-row">
              <div><label>DNI</label><input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} maxLength={8} style={{ width: '100%' }} /></div>
              <div><label>Correo</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Teléfono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={{ width: '100%' }} /></div>
            </div>

            {form.rol === 'PACIENTE' && (
              <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff', borderRadius: 10, border: '1px solid #dbeafe' }}>
                <h3 style={{ color: '#0d5fa7', marginBottom: '0.5rem' }}>Datos del paciente</h3>
                <div className="form-row">
                  <div><label>Fecha de nacimiento *</label><input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} style={{ width: '100%' }} /></div>
                  <div><label>Centro de salud asignado</label>
                    <select value={form.centro_salud_asignado} onChange={(e) => setForm({ ...form, centro_salud_asignado: e.target.value })} style={{ width: '100%' }}>
                      <option value="">— Sin asignar —</option>
                      {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <label>Dirección</label>
                <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} style={{ width: '100%' }} />
                <label>Contacto de emergencia</label>
                <input value={form.contacto_emergencia} onChange={(e) => setForm({ ...form, contacto_emergencia: e.target.value })} placeholder="Nombre y teléfono" style={{ width: '100%' }} />
              </div>
            )}

            {form.rol === 'MEDICO' && (
              <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <h3 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>Datos del médico (Perfil Médico)</h3>
                <div className="form-row">
                  <div><label>Especialidad *</label>
                    <select value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} required style={{ width: '100%' }}>
                      <option value="">— Selecciona —</option>
                      {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                  <div><label>Centro de salud *</label>
                    <select value={form.centro_salud} onChange={(e) => setForm({ ...form, centro_salud: e.target.value })} required style={{ width: '100%' }}>
                      <option value="">— Selecciona —</option>
                      {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <label>Número de colegiatura</label>
                <input value={form.numero_colegiatura} onChange={(e) => setForm({ ...form, numero_colegiatura: e.target.value })} placeholder="Ej. CMP-12345" style={{ width: '100%' }} />
              </div>
            )}

            {form.rol === 'ADMIN' && (
              <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff', borderRadius: 10, border: '1px solid #ddd6fe' }}>
                <p style={{ color: '#7c3aed', fontSize: '0.85rem' }}>El administrador no requiere datos adicionales. Tendrá acceso completo al panel, auditoría y respaldos.</p>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-grande" style={{ background: ri.color, color: '#fff', width: '100%', padding: '0.7rem', fontSize: '1rem' }}>
                Crear {ri.label}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2>Usuarios del sistema</h2>
          <div className="table-wrap">
            <table style={{ width: '100%' }}>
              <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>DNI</th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}><td>{u.username}</td><td>{u.first_name} {u.last_name}</td>
                    <td><span className={`badge role-${u.rol.toLowerCase()}`}>{u.rol}</span></td><td>{u.dni}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <button className="btn btn-ok" onClick={respaldo}>Generar respaldo de datos</button>
          </div>
        </div>

        <div className="card">
          <h2>Migracion legacy (JSP)</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            El modulo <code>patient-sync.jsp</code> publica historiales CSV en /api/v1/legacy/importar/.
            Aqui el admin valida cada registro y crea (o rechaza) el paciente vinculado.
          </p>
          <button className="btn btn-sec" onClick={simularImportLegacy}>Simular import JSP (2 registros)</button>
          {legacy.length > 0 && (
            <div className="table-wrap" style={{ marginTop: '0.6rem' }}>
              <table>
                <thead><tr><th>Legacy ID</th><th>DNI</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {legacy.map((l) => (
                    <tr key={l.id}>
                      <td>{l.paciente_legacy_id}</td>
                      <td>{l.datos_csv.dni}</td>
                      <td>{l.validado ? (l.paciente_vinculado ? 'Migrado' : 'Rechazado') : 'Pendiente'}</td>
                      <td>{!l.validado && <>
                        <button className="btn btn-ok" onClick={() => validarLegacy(l.id, 'crear_paciente')}>Crear paciente</button>{' '}
                        <button className="btn btn-peligro" onClick={() => validarLegacy(l.id, 'rechazar')}>Rechazar</button>
                      </>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {msg && <div className="ok-banner">{msg}</div>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Auditoria inmutable de accesos (LogAuditoria)</h2>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
          <button className={`btn ${filtroLog === 'CAMBIOS' ? '' : 'btn-outline'}`} onClick={() => setFiltroLog('CAMBIOS')}>Cambios (CREATE/UPDATE/DELETE/POST)</button>
          <button className={`btn ${filtroLog === 'CREATES' ? '' : 'btn-outline'}`} onClick={() => setFiltroLog('CREATES')}>Solo CREATES</button>
          <button className={`btn ${filtroLog === 'POST' ? '' : 'btn-outline'}`} onClick={() => setFiltroLog('POST')}>Solo POST</button>
          <button className={`btn ${filtroLog === 'TODO' ? '' : 'btn-outline'}`} onClick={() => setFiltroLog('TODO')}>Todo (incluye GET)</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Timestamp</th><th>Usuario</th><th>Accion</th><th>Modelo</th><th>Objeto</th><th>IP</th><th>Detalle</th></tr></thead>
            <tbody>
              {logsFiltrados.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleString('es-PE')}</td>
                  <td>{l.usuario}</td><td><b>{l.accion}</b></td>
                  <td>{l.modelo_afectado || '-'}</td><td>{l.objeto_id || '-'}</td>
                  <td>{l.ip_address || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{l.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}