// Cliente API con JWT, refresh automatico y manejo de expiracion (RNF-05)
const BASE = '/api/v1'

let onSessionExpired = () => {}
export const setOnSessionExpired = (fn) => { onSessionExpired = fn }

export const getToken = () => localStorage.getItem('access')
export const setTokens = ({ access, refresh }) => {
  if (access) localStorage.setItem('access', access)
  if (refresh) localStorage.setItem('refresh', refresh)
}
export const clearTokens = () => {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('user')
}

async function refreshToken() {
  const refresh = localStorage.getItem('refresh')
  if (!refresh) return false
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return false
  const data = await res.json()
  setTokens({ access: data.access })
  return true
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !formData) headers['Content-Type'] = 'application/json'

  let res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  })

  if (res.status === 401 && token) {
    const ok = await refreshToken()
    if (ok) {
      headers.Authorization = `Bearer ${getToken()}`
      res = await fetch(`${BASE}${path}`, {
        method, headers,
        body: formData || (body ? JSON.stringify(body) : undefined),
      })
    } else {
      clearTokens()
      onSessionExpired()
      throw new Error('Sesion expirada (15 min de inactividad).')
    }
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const msg = data?.detail || JSON.stringify(data) || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
