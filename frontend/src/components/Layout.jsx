import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'

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
  const visible = NAV.filter((n) => n.roles.includes(user.rol))

  const cerrarSesion = () => { logout(); navigate('/login') }

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
        <button className="hamburger" onClick={() => setAbierto(!abierto)}>☰ Menú</button>
        <Outlet />
      </main>
    </div>
  )
}