import { useEffect, useState } from 'react'
import { api } from '../services/api'

// RF-07: panel administrativo - usuarios, auditoria inmutable, respaldo
// + RF-09: validacion de registros legacy importados desde el modulo JSP
export default function Admin() {
  const [usuarios, setUsuarios] = useState([])
  const [logs, setLogs] = useState([])
  const [legacy, setLegacy] = useState([])
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '', rol: 'PACIENTE', email: '', dni: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const cargar = () => {
    api('/auth/usuarios/?page_size=100').then((d) => setUsuarios(d.results || d)).catch((e) => setError(e.message))
    api('/admin-panel/auditoria/?page_size=30').then((d) => setLogs(d.results || d)).catch((e) => setError(e.message))
    api('/legacy/?page_size=30').then((d) => setLegacy(d.results || d)).catch((e) => setError(e.message))
  }
  useEffect(cargar, [])

  const crearUsuario = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      await api('/auth/usuarios/', { method: 'POST', body: form })
      setMsg(`Usuario ${form.username} creado.`)
      setForm({ username: '', password: '', first_name: '', last_name: '', rol: 'PACIENTE', email: '', dni: '' })
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const respaldo = async () => {
    const r = await api('/admin-panel/auditoria/respaldo/', { method: 'POST' })
    setMsg(`${r.detail} ${JSON.stringify(r.resumen)}`)
  }

  // Simula lo que haria el modulo JSP legacy (importa CSV a staging)
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

  return (
    <div>
      <div className="grid">
        <div className="card">
          <h2>Crear usuario</h2>
          <form onSubmit={crearUsuario}>
            <div className="form-row">
              <div><label>Usuario</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
              <div><label>DNI</label><input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div><label>Nombres</label><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label>Apellidos</label><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <label>Correo</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label>Contrasena (min 8)</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="PACIENTE">Paciente</option><option value="MEDICO">Medico</option><option value="ADMIN">Administrador</option>
            </select>
            <div style={{ marginTop: '0.8rem' }}><button className="btn">Crear</button></div>
          </form>
        </div>

        <div className="card">
          <h2>Usuarios del sistema</h2>
          <table>
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>DNI</th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}><td>{u.username}</td><td>{u.first_name} {u.last_name}</td>
                  <td><span className={`badge role-${u.rol.toLowerCase()}`}>{u.rol}</span></td><td>{u.dni}</td></tr>
              ))}
            </tbody>
          </table>
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
            <table style={{ marginTop: '0.6rem' }}>
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
          )}
        </div>
      </div>

      {msg && <div className="ok-banner">{msg}</div>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Auditoria inmutable de accesos (LogAuditoria)</h2>
        <table>
          <thead><tr><th>Timestamp</th><th>Usuario</th><th>Accion</th><th>Modelo</th><th>Objeto</th><th>IP</th><th>Detalle</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString('es-PE')}</td>
                <td>{l.usuario}</td><td><b>{l.accion}</b></td>
                <td>{l.modelo_afectado || '-'}</td><td>{l.objeto_id || '-'}</td>
                <td>{l.ip_address || '-'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{l.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}