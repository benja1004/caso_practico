import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { api } from '../services/api'

const NAV = [
  { to: '/', label: 'Citas', icon: '📅', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/monitoreo', label: 'Monitoreo', icon: '❤️', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/dashboard', label: 'Mis tendencias', icon: '📈', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/horario', label: 'Mi Horario', icon: '🗓️', roles: ['MEDICO', 'ADMIN'] },
  { to: '/prescripciones', label: 'Prescripciones', icon: '💊', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/derivaciones', label: 'Derivaciones', icon: '🔁', roles: ['ADMIN', 'MEDICO', 'PACIENTE'] },
  { to: '/admin', label: 'Administración', icon: '⚙️', roles: ['ADMIN'] },
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

  // Polling de notificaciones cada 30s: alertas sin atender + derivaciones pendientes
  // (para medico) + citas pendientes de confirmar
  useEffect(() => {
    let timer
    const cargar = async () => {
      try {
        const items = []
        // Citas pendientes de confirmar (medico/admin)
        if (esMedico) {
          const c = await api('/citas/?page_size=50&estado=PENDIENTE')
          ;(c.results || c).forEach((x) => items.push({
            id: 'c' + x.id, tipo: 'cita', icon: '📅',
            texto: `Cita pendiente: ${x.paciente_nombre} — ${new Date(x.fecha_hora).toLocaleString('es-PE')}`,
            link: '/'
          }))
        }
        // Alertas no atendidas
        const a = await api('/alertas/?atendida=false&page_size=30')
        ;(a.results || a).forEach((x) => items.push({
          id: 'a' + x.id, tipo: 'alerta', icon: '⚠️', critico: x.nivel === 'CRITICO',
          texto: `Alerta ${x.nivel}: ${x.signo_tipo} ${x.signo_valor} — ${x.paciente}`,
          link: '/monitoreo'
        }))
        // Derivaciones pendientes recibidas como medico
        if (esMedico) {
          const d = await api('/derivaciones/?page_size=50&estado=PENDIENTE')
          ;(d.results || d).forEach((x) => items.push({
            id: 'd' + x.id, tipo: 'deriv', icon: '🔁',
            texto: `Derivación: ${x.paciente_nombre} → ${x.especialidad_destino_nombre}`,
            link: '/derivaciones'
          }))
        }
        const nuevas = items.length
        if (nuevas > vistas) {
          // Notificacion del navegador (si el usuario ya autorizo)
          if ('Notification' in window && Notification.permission === 'granted' && nuevas > 0) {
            new Notification('SALUDCONNECT', { body: `Tienes ${nuevas} notificaciones nuevas.` })
          }
        }
        setNotifs(items)
        setVistas(items.length)
      } catch (e) { /* sin sesión: ignora */ }
    }
    // Pide permiso una vez
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
              <span className="ic">{n.icon}</span> {n.label}
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
        {/* Barra superior con campana de notificaciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem', position: 'relative' }}>
          <button className="btn btn-outline" style={{ position: 'relative' }} onClick={() => setNotifAbierta(!notifAbierta)}>
            🔔
            {noLeidas > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6, background: '#dc2626', color: '#fff',
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
                ? <div style={{ color: '#64748b', fontSize: '0.85rem', padding: 8 }}>Sin notificaciones. Todo en orden. ✓</div>
                : notifs.map((n) => (
                  <div key={n.id} onClick={() => { navigate(n.link); setNotifAbierta(false) }}
                    style={{ padding: '0.5rem 0.4rem', cursor: 'pointer', borderBottom: '1px dashed #e2e8f0', fontSize: '0.85rem', display: 'flex', gap: 8 }}>
                    <span>{n.icon}</span>
                    <span style={{ color: n.critico ? '#dc2626' : '#0f172a', fontWeight: n.critico ? 700 : 500 }}>{n.texto}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <button className="hamburger" onClick={() => setAbierto(!abierto)}>☰ Menú</button>
        <Outlet />
      </main>
    </div>
  )
}