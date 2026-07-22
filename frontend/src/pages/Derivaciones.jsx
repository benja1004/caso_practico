import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'

// RF-06: derivacion con especialidad destino, centros, especialista filtrado por especialidad
const ESTADOS = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'COMPLETADA']
const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA']

export default function Derivaciones() {
  const { user } = useAuthContext()
  const [lista, setLista] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [centros, setCentros] = useState([])
  const [form, setForm] = useState({ paciente: '', especialidad_destino: '', especialista_destino: '', centro_origen: '', centro_destino: '', motivo: '', prioridad: 'MEDIA' })
  const [adjunto, setAdjunto] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const esMedico = user.rol === 'MEDICO' || user.rol === 'ADMIN'

  const cargar = () => api('/derivaciones/?page_size=50').then((d) => setLista(d.results || d)).catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
    api('/pacientes/?page_size=100').then((d) => setPacientes(d.results || d)).catch(() => {})
    api('/especialidades/').then((d) => setEspecialidades(d.results || d)).catch(() => {})
    api('/perfiles-medico/?page_size=100').then((d) => {
      const perfiles = d.results || d
      setPerfiles(perfiles.map((p) => ({ id: p.usuario, especialidad: p.especialidad, nombre: `${p.usuario_nombre}` })))
    }).catch(() => {})
    api('/centros/').then((d) => setCentros(d.results || d)).catch(() => {})
  }, [])

  // Filtra especialistas por especialidad seleccionada
  const especialistasFiltrados = perfiles.filter((p) => !form.especialidad_destino || p.especialidad === parseInt(form.especialidad_destino))

  const crear = async (e) => {
    e.preventDefault()
    setMsg(''); setError('')
    try {
      const body = {
        paciente: form.paciente,
        especialidad_destino: form.especialidad_destino,
        especialista_destino: form.especialista_destino || null,
        centro_origen: form.centro_origen,
        centro_destino: form.centro_destino,
        motivo: form.motivo,
        prioridad: form.prioridad,
      }
      const r = await api('/derivaciones/', { method: 'POST', body })
      setMsg('Derivacion enviada. Se notifico al especialista destino.')
      // Adjuntar documento si hay
      if (adjunto) {
        const fd = new FormData()
        fd.append('archivo', adjunto)
        fd.append('tipo_documento', adjunto.name.split('.').pop().toUpperCase())
        await api(`/derivaciones/${r.id}/adjuntos/`, { formData: fd })
      }
      setForm({ paciente: '', especialidad_destino: '', especialista_destino: '', centro_origen: '', centro_destino: '', motivo: '', prioridad: 'MEDIA' })
      setAdjunto(null)
      cargar()
    } catch (err) { setError(JSON.stringify(err.data) || err.message) }
  }

  const cambiarEstado = async (id, estado) => {
    try {
      await api(`/derivaciones/${id}/cambiar_estado/`, { method: 'POST', body: { estado } })
      cargar()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="grid">
      {esMedico && (
        <div className="card">
          <h2>Nueva derivacion</h2>
          <form onSubmit={crear}>
            <label>Paciente</label>
            <select value={form.paciente} onChange={(e) => setForm({ ...form, paciente: e.target.value })} required>
              <option value="">--</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
            </select>
            <div className="form-row">
              <div><label>Especialidad destino</label>
                <select value={form.especialidad_destino} onChange={(e) => setForm({ ...form, especialidad_destino: e.target.value, especialista_destino: '' })} required>
                  <option value="">--</option>
                  {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div><label>Especialista (filtrado)</label>
                <select value={form.especialista_destino} onChange={(e) => setForm({ ...form, especialista_destino: e.target.value })}>
                  <option value="">Cualquier especialista</option>
                  {especialistasFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div><label>Centro origen</label>
                <select value={form.centro_origen} onChange={(e) => setForm({ ...form, centro_origen: e.target.value })} required>
                  <option value="">--</option>
                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label>Centro destino</label>
                <select value={form.centro_destino} onChange={(e) => setForm({ ...form, centro_destino: e.target.value })} required>
                  <option value="">--</option>
                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <label>Prioridad</label>
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <label>Motivo clinico</label>
            <textarea rows="3" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} required />
            <label>Documento de soporte (AdjuntoDerivacion)</label>
            <input type="file" onChange={(e) => setAdjunto(e.target.files[0])} />
            <div style={{ marginTop: '0.8rem' }}><button className="btn">Enviar derivacion</button></div>
          </form>
          {msg && <div className="ok-banner" style={{ marginTop: '0.6rem' }}>{msg}</div>}
          {error && <p className="error">{error}</p>}
        </div>
      )}

      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h2>Seguimiento de derivaciones</h2>
        <table>
          <thead><tr>
            <th>Paciente</th><th>Origen</th><th>Especialidad</th><th>Destino</th><th>Prioridad</th><th>Estado</th>{esMedico && <th>Acciones</th>}
          </tr></thead>
          <tbody>
            {lista.map((d) => (
              <tr key={d.id}>
                <td>{d.paciente_nombre}</td>
                <td>{d.medico_origen_nombre}<br /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.centro_origen_nombre}</span></td>
                <td>{d.especialidad_destino_nombre}</td>
                <td>{d.especialista_destino_nombre}<br /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.centro_destino_nombre}</span></td>
                <td><b>{d.prioridad}</b></td>
                <td><span className={`badge estado-${d.estado}`}>{d.estado}</span></td>
                {esMedico && (
                  <td>
                    <select defaultValue="" onChange={(e) => e.target.value && cambiarEstado(d.id, e.target.value)}>
                      <option value="">Cambiar...</option>
                      {ESTADOS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}