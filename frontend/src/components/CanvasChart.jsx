import { useEffect, useRef } from 'react'

// RF-04: grafico de tendencias con Canvas puro (sin librerias).
// Soporta series multiples (ej. presion: sistolica + diastolica).
// Dibuja ejes, lineas de tendencia, banda de rango clinico (verde) y puntos en alerta (rojo).
export default function CanvasChart({ titulo, series = [], rango, unidad = '', height = 260 }) {
  // series: [{ nombre, color, puntos: [{valor, en_alerta}] }]
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = (canvas.width = canvas.offsetWidth * devicePixelRatio)
    const H = (canvas.height = height * devicePixelRatio)
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const w = canvas.offsetWidth, h = height
    ctx.clearRect(0, 0, w, h)

    const todos = series.flatMap((s) => s.puntos.map((p) => p.valor))
    if (!todos.length) {
      ctx.fillStyle = '#888'
      ctx.fillText('Sin datos para graficar', 20, 30)
      return
    }

    const pad = { l: 46, r: 12, t: 28, b: 26 }
    let min = Math.min(...todos), max = Math.max(...todos)
    if (rango) { min = Math.min(min, rango.min); max = Math.max(max, rango.max) }
    const m = (max - min) * 0.15 || 1
    min -= m; max += m
    const maxLen = Math.max(...series.map((s) => s.puntos.length), 1)
    const x = (i) => pad.l + (i / Math.max(maxLen - 1, 1)) * (w - pad.l - pad.r)
    const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b)

    ctx.fillStyle = '#0f4c81'
    ctx.font = 'bold 13px system-ui'
    ctx.fillText(`${titulo}${unidad ? ` (${unidad})` : ''}`, pad.l, 16)

    if (rango) {
      ctx.fillStyle = 'rgba(46, 204, 113, 0.12)'
      ctx.fillRect(pad.l, y(rango.max), w - pad.l - pad.r, y(rango.min) - y(rango.max))
    }

    ctx.strokeStyle = '#cbd5e1'
    ctx.beginPath()
    ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b)
    ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '11px system-ui'
    for (let i = 0; i <= 4; i++) {
      const v = min + ((max - min) * i) / 4
      ctx.fillText(v.toFixed(0), 6, y(v) + 4)
    }

    series.forEach((s) => {
      ctx.strokeStyle = s.color || '#0f4c81'
      ctx.lineWidth = 2
      ctx.beginPath()
      s.puntos.forEach((p, i) =>
        (i ? ctx.lineTo(x(i), y(p.valor)) : ctx.moveTo(x(i), y(p.valor))))
      ctx.stroke()
      s.puntos.forEach((p, i) => {
        ctx.fillStyle = p.en_alerta ? '#e74c3c' : (s.color || '#0f4c81')
        ctx.beginPath()
        ctx.arc(x(i), y(p.valor), p.en_alerta ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fill()
      })
    })
  }, [series, rango, titulo, unidad, height])

  return <canvas ref={ref} className="chart" style={{ height }} />
}