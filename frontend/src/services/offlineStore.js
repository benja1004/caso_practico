// RNF-03: modo offline para registro de signos.
// Cola persistente en localStorage (IndexedDB simulado) + sincronizacion.
import { api } from './api'

const KEY = 'signos_offline_queue'

export const getQueue = () => JSON.parse(localStorage.getItem(KEY) || '[]')

export function enqueueSigno(signo) {
  const q = getQueue()
  q.push({ ...signo, capturado_en: new Date().toISOString(), encolado_en: new Date().toISOString() })
  localStorage.setItem(KEY, JSON.stringify(q))
  return q.length
}

export async function syncQueue() {
  const q = getQueue()
  if (!q.length) return { sincronizados: 0 }
  const cuerpo = q.map((it) => ({
    paciente: it.paciente, tipo: it.tipo, valor: it.valor,
    valor_sistolica: it.valor_sistolica, valor_diastolica: it.valor_diastolica,
    unidad: it.unidad, capturado_en: it.capturado_en, dispositivo_id: 'web',
  }))
  let ok = 0, fallidos = []
  try {
    const r = await api('/signos/sincronizar_offline/', { method: 'POST', body: cuerpo })
    ok = r.sincronizados || q.length
  } catch {
    fallidos = q
  }
  localStorage.setItem(KEY, JSON.stringify(fallidos))
  return { sincronizados: ok, pendientes: fallidos.length }
}

export const isOnline = () => navigator.onLine