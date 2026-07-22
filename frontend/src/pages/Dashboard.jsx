import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuthContext } from '../context/AuthContext'
import CanvasChart from '../components/CanvasChart'
import jsPDF from 'jspdf'

// RF-04: visualizacion de tendencias historicas con Canvas + exportacion PDF
const RANGOS = {
  GLUCOSA: { min: 80, max: 180 }, SPO2: { min: 88, max: 100 },
  TEMPERATURA: { min: 36, max: 37.5 },
}

export default function Dashboard() {
  const { user } = useAuthContext()
  const [pacientes, setPacientes] = useState([])
  const [pacienteId, setPacienteId] = useState('')
  const [series, setSeries] = useState({})
  const [tipo, setTipo] = useState('GLUCOSA')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/pacientes/?page_size=100')
      .then((d) => {
        const lista = d.results || d
        setPacientes(lista)
        if (lista.length) setPacienteId(String(lista[0].id))
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!pacienteId) return
    api(`/signos/tendencias/?paciente=${pacienteId}`)
      .then((d) => setSeries(d.series))
      .catch((e) => setError(e.message))
  }, [pacienteId])

  const isPresion = tipo === 'PRESION'
  let chartSeries = []
  let rango = null
  const unidad = { GLUCOSA: 'mg/dL', SPO2: '%', TEMPERATURA: '°C', PRESION: 'mmHg' }[tipo]
  if (isPresion) {
    const pts = series.PRESION || []
    chartSeries = [
      { nombre: 'Sistolica', color: '#e74c3c',
        puntos: pts.map((p) => ({ valor: p.sistolica, en_alerta: p.en_alerta })) },
      { nombre: 'Diastolica', color: '#0f4c81',
        puntos: pts.map((p) => ({ valor: p.diastolica, en_alerta: p.en_alerta })) },
    ]
  } else {
    chartSeries = [{ nombre: tipo, color: '#0f4c81',
      puntos: (series[tipo] || []).map((p) => ({ valor: p.valor, en_alerta: p.en_alerta })) }]
    rango = RANGOS[tipo]
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    const pac = pacientes.find((p) => String(p.id) === String(pacienteId))
    doc.setFontSize(16)
    doc.text('SALUDCONNECT - Reporte de tendencias', 14, 15)
    doc.setFontSize(11)
    doc.text(`Paciente: ${pac?.nombre_completo || ''} (DNI ${pac?.dni || ''})`, 14, 24)
    doc.text(`Condiciones: ${(pac?.condiciones || []).map((c) => c.nombre).join(', ') || '-'}`, 14, 31)
    doc.text(`Generado por: ${user.first_name} ${user.last_name} (${user.rol})`, 14, 38)
    let y = 48
    Object.entries(series).forEach(([t, pts]) => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(`${t}: ${pts.length} registros`, 14, y)
      y += 7
    })
    const canvas = document.querySelector('.chart')
    if (canvas) {
      doc.addPage()
      doc.text(`Grafico: ${tipo}`, 14, 15)
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 22, 180, 70)
    }
    doc.save(`tendencias_${pac?.dni || 'paciente'}.pdf`)
  }

  return (
    <div>
      <div className="card">
        <h2>Dashboard clinico - Tendencias historicas</h2>
        <div className="form-row">
          <div>
            <label>Paciente</label>
            <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo} - {(p.condiciones || []).map((c) => c.codigo).join(',') || 'sin condicion'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Signo vital</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="GLUCOSA">Glucosa</option>
              <option value="PRESION">Presion arterial</option>
              <option value="SPO2">SpO2</option>
              <option value="TEMPERATURA">Temperatura</option>
            </select>
          </div>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn btn-ok" onClick={exportarPDF}>Exportar PDF</button>
          </div>
        </div>
      </div>
      {error && <div className="alerta">{error}</div>}
      <div className="card">
        {isPresion ? (
          <>
            <CanvasChart titulo="Presion arterial" series={chartSeries} unidad={unidad} />
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Linea roja = sistolica, linea azul = diastolica. Puntos rojos = fuera de rango.
            </p>
          </>
        ) : (
          <>
            <CanvasChart titulo={tipo} series={chartSeries} rango={rango} unidad={unidad} />
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Banda verde: rango saludable (ajustado a la condicion cronica del paciente).
              Puntos rojos: valores fuera de rango (generan alerta automatica).
            </p>
          </>
        )}
      </div>
    </div>
  )
}