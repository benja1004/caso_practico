import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthContext } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Citas from './pages/Citas'
import Horario from './pages/Horario'
import Monitoreo from './pages/Monitoreo'
import Dashboard from './pages/Dashboard'
import Prescripciones from './pages/Prescripciones'
import Derivaciones from './pages/Derivaciones'
import Admin from './pages/Admin'
import MFASetup from './pages/MFASetup'
import VerificarQR from './pages/VerificarQR'
import Pacientes from './pages/Pacientes'

function PrivateRoute({ children, roles }) {
  const { user } = useAuthContext()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user } = useAuthContext()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/verificar-qr" element={<VerificarQR />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Citas />} />
        <Route path="horario" element={
          <PrivateRoute roles={['MEDICO', 'ADMIN']}><Horario /></PrivateRoute>
        } />
        <Route path="monitoreo" element={<Monitoreo />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="prescripciones" element={<Prescripciones />} />
        <Route path="derivaciones" element={<Derivaciones />} />
        <Route path="mfa-setup" element={<MFASetup />} />
        <Route path="admin" element={
          <PrivateRoute roles={['ADMIN']}><Admin /></PrivateRoute>
        } />
      </Route>
    </Routes>
  )
}