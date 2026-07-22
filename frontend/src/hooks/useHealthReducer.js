import { useReducer } from 'react'

// Hook requerido por el caso: useHealthReducer
// Gestiona el estado de signos vitales (lista, alertas, sincronizacion offline)

const initialState = {
  signos: [],
  alertas: [],
  cargando: false,
  error: null,
  pendientesOffline: 0,
}

function healthReducer(state, action) {
  switch (action.type) {
    case 'CARGANDO':
      return { ...state, cargando: true, error: null }
    case 'ERROR':
      return { ...state, cargando: false, error: action.payload }
    case 'SET_SIGNOS': {
      const alertas = action.payload.filter((s) => s.en_alerta)
      return { ...state, signos: action.payload, alertas, cargando: false }
    }
    case 'ADD_SIGNO': {
      const signos = [action.payload, ...state.signos]
      const alertas = action.payload.en_alerta
        ? [action.payload, ...state.alertas]
        : state.alertas
      return { ...state, signos, alertas }
    }
    case 'SET_PENDIENTES':
      return { ...state, pendientesOffline: action.payload }
    default:
      return state
  }
}

export function useHealthReducer() {
  return useReducer(healthReducer, initialState)
}
