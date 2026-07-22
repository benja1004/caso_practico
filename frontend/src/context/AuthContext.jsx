import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, clearTokens, setOnSessionExpired, setTokens } from '../services/api'

const AuthContext = createContext(null)

// Hook requerido por el caso: useAuthContext
export const useAuthContext = () => useContext(AuthContext)

const IDLE_LIMIT = 15 * 60 * 1000 // RNF-05: timeout 15 min

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const idleTimer = useRef(null)

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  // Timeout de sesion por inactividad (15 min)
  useEffect(() => {
    if (!user) return
    const reset = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(logout, IDLE_LIMIT)
    }
    const events = ['mousemove', 'keydown', 'click']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(idleTimer.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user, logout])

  useEffect(() => { setOnSessionExpired(logout) }, [logout])

  // RF-01 paso 1: credenciales -> devuelve { mfa_required, dev_code }
  const login = async (username, password) => {
    const res = await fetch('/api/v1/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Credenciales invalidas')
    return data
  }

  // RF-01 paso 2: codigo MFA -> tokens + usuario
  const verifyMfa = async (username, code) => {
    const res = await fetch('/api/v1/auth/mfa/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, code }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Codigo invalido')
    setTokens(data)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  return (
    <AuthContext.Provider value={{ user, login, verifyMfa, logout, api }}>
      {children}
    </AuthContext.Provider>
  )
}
