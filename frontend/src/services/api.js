// Cliente API con JWT, refresh automatico, manejo de expiracion (RNF-05)
// y manejo de throttle 429 con cuenta regresiva.
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

// Extrae segundos de espera del mensaje de throttle de DRF
function _segundosThrottle(mensaje) {
  if (!mensaje) return 30
  const m = String(mensaje).match(/(\d+)\s*segundo/i) || String(mensaje).match(/(\d+)\s*second/i)
  return m ? parseInt(m[1]) : 30
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
      throw new Error('Sesión expirada (15 min de inactividad). Vuelve a ingresar.')
    }
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    // 429: throttle -Friendly message with countdown
    if (res.status === 429) {
      const seg = _segundosThrottle(data?.detail)
      const err = new Error(`Demasiadas peticiones. Reintenta en ${seg} segundo(s).`)
      err.status = 429
      err.retryAfter = seg
      err.data = data
      throw err
    }
    const msg = data?.detail || (data && JSON.stringify(data)) || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// Utilidad para dormir (usada al reintentar tras 429 en el frontend)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))