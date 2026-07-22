import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { api } from '../services/api'

const NAV = [
  { to: '/', label: 'Citas', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/pacientes', label: 'Pacientes', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/monitoreo', label: 'Monitoreo', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/dashboard', label: 'Mis tendencias', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/horario', label: 'Mi Horario', roles: ['MEDICO', 'ADMIN'] },
  { to: '/prescripciones', label: 'Prescripciones', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/derivaciones', label: 'Derivaciones', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/admin', label: 'Administración', roles: ['ADMIN'] },
]

export default function Layout() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [notifAbierta, setNotifAbierta] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [vistas, setVistas] = useState(0)
  const visible = NAV.filter((n) => n.roles.includes(user.rol))
  const esMedico = user.rol === 'MEDICO' || user.rol === 'ADMIN'

  const cerrarSesion = () => { logout(); navigate('/login') }

  useEffect(() => {
    let timer
    const cargar = async () => {
      try {
        const items = []
        if (esMedico) {
          const c = await api('/citas/?page_size=50&estado=PENDIENTE')
          ;(c.results || c).forEach((x) => items.push({
            id: 'c' + x.id, tipo: 'cita',
            texto: `Cita pendiente: ${x.paciente_nombre} — ${new Date(x.fecha_hora).toLocaleString('es-PE')}`,
            link: '/'
          }))
        }
        const a = await api('/alertas/?atendida=false&page_size=30')
        ;(a.results || a).forEach((x) => items.push({
          id: 'a' + x.id, tipo: 'alerta', critico: x.nivel === 'CRITICO',
          texto: `Alerta ${x.nivel}: ${x.signo_tipo} ${x.signo_valor} — ${x.paciente}`,
          link: '/monitoreo'
        }))
        if (esMedico) {
          const d = await api('/derivaciones/?page_size=50&estado=PENDIENTE')
          ;(d.results || d).forEach((x) => items.push({
            id: 'd' + x.id, tipo: 'deriv',
            texto: `Derivación: ${x.paciente_nombre} → ${x.especialidad_destino_nombre}`,
            link: '/derivaciones'
          }))
        }
        try {
          const n = await api('/admin-panel/auditoria/?accion=NOTIF&usuario=' + user.username)
          ;(n.results || n).forEach((x) => items.push({
            id: 'n' + x.id, tipo: 'notif',
            texto: x.detalle, link: '/derivaciones'
          }))
        } catch (e) {
          console.error("Error cargando notificaciones:", e)
        }
        const nuevas = items.length
        if (nuevas > vistas) {
          if ('Notification' in window && Notification.permission === 'granted' && nuevas > 0) {
            new Notification('SALUDCONNECT', { body: `Tienes ${nuevas} notificaciones nuevas.` })
          }
        }
        setNotifs(items)
        setVistas(items.length)
      } catch (e) { /* sin sesión */ }
    }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    cargar()
    timer = setInterval(cargar, 30000)
    return () => clearInterval(timer)
  }, [user.rol])

  const noLeidas = notifs.length

  return (
    <div className="app">
      <aside className={`sidebar ${abierto ? 'abierto' : ''}`}>
        <div className="sidebar-brand">
          <span className="logo">+</span>
          <span>SALUD<span style={{ color: '#38bdf8' }}>CONNECT</span></span>
        </div>
        <nav className="sidebar-nav">
          {visible.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}
              onClick={() => setAbierto(false)}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="fila">
            <span>{user.first_name || user.username}</span>
            <span className="rol">{user.rol}</span>
          </div>
          <button className="btn btn-outline btn-block" style={{ marginTop: '0.5rem', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.3)' }} onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem', position: 'relative' }}>
          <button className="btn btn-outline" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setNotifAbierta(!notifAbierta)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Notificaciones
            {noLeidas > 0 && (
              <span style={{
                background: '#dc2626', color: '#fff',
                borderRadius: 999, fontSize: '0.7rem', padding: '1px 6px', fontWeight: 800
              }}>{noLeidas}</span>
            )}
          </button>
          {notifAbierta && (
            <div className="card" style={{ position: 'absolute', top: 40, right: 0, width: 360, maxHeight: 400, overflowY: 'auto', zIndex: 100, padding: '0.6rem' }}>
              <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 6 }}>
                Notificaciones ({notifs.length})
              </h3>
              {notifs.length === 0
                ? <div style={{ color: '#64748b', fontSize: '0.85rem', padding: 8 }}>Sin notificaciones pendientes.</div>
                : notifs.map((n) => (
                  <div key={n.id} onClick={() => { navigate(n.link); setNotifAbierta(false) }}
                    style={{ padding: '0.5rem 0.4rem', cursor: 'pointer', borderBottom: '1px dashed #e2e8f0', fontSize: '0.85rem' }}>
                    <span style={{ color: n.critico ? '#dc2626' : '#0f172a', fontWeight: n.critico ? 700 : 500 }}>{n.texto}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <button className="hamburger" onClick={() => setAbierto(!abierto)}>Menú</button>
        <Outlet />
      </main>
    </div>
  )
}