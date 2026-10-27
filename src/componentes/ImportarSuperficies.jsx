import { useState } from 'react'
import { delDxf } from '../dominio/ejes'
import { fmt } from '../dominio/redondeo'
import { areaPoligono, leerPoligonosDxf, UNIDADES_DXF } from '../dominio/terreno'
import { botones } from '../lib/ui'
import { Boton, Entrada } from './ui'

/** ¿El punto cae dentro del polígono? (rayo horizontal) */
const dentro = ([x, y], pol) => {
  let c = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i]
    const [xj, yj] = pol[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/**
 * Importa superficies (losas, firmes…) de las polilíneas cerradas de un DXF, ya en coordenadas
 * del proyecto (con el origen de los ejes). Los polígonos que caen dentro de otro elegido se
 * pueden restar como huecos: así una banda de losa es su contorno menos la parte delgada.
 */
export default function ImportarSuperficies({ ejes, onAgregar, conEspesor = true }) {
  const [unidad, setUnidad] = useState('m')
  const [lista, setLista] = useState(null)
  const [capa, setCapa] = useState('')
  const [elegidos, setElegidos] = useState(new Set())
  const [espesor, setEspesor] = useState('0.1')
  const [restar, setRestar] = useState(true)
  const [error, setError] = useState(null)

  async function leer(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    try {
      const pols = leerPoligonosDxf(await archivo.text(), UNIDADES_DXF[unidad]).map((p, i) => ({ ...p, id: i, vertices: p.vertices.map((v) => delDxf(ejes, v)) }))
      if (!pols.length) throw new Error('El DXF no tiene polilíneas cerradas.')
      setLista({ archivo: archivo.name, pols })
      setCapa(pols[0].capa)
      setElegidos(new Set())
    } catch (err) {
      setError(err.message)
    }
  }

  if (!lista)
    return (
      <span className="flex items-center gap-1.5">
        <label className="inline-flex cursor-pointer items-center" style={{ ...botones.sec, padding: '4px 10px', fontSize: 12 }}>
          Importar del DXF
          <input type="file" accept=".dxf" className="hidden" onChange={leer} />
        </label>
        <select value={unidad} onChange={(e) => setUnidad(e.target.value)} title="Unidades del dibujo">
          {Object.keys(UNIDADES_DXF).map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {!ejes?.origen_dxf && <span className="text-[11px]" style={{ color: '#f0b866' }} title="Sin ejes del proyecto, los polígonos quedan en las coordenadas del dibujo">sin ejes</span>}
        {error && <span className="text-[11px]" style={{ color: '#f87171' }}>{error}</span>}
      </span>
    )

  const capas = [...new Set(lista.pols.map((p) => p.capa))]
  const deCapa = lista.pols.filter((p) => p.capa === capa)
  const alternar = (id) =>
    setElegidos((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  function agregar() {
    const sel = lista.pols.filter((p) => elegidos.has(p.id))
    const nuevas = sel.map((p, k) => {
      const huecos = restar ? sel.filter((q) => q !== p && q.area < p.area && q.vertices.every((v) => dentro(v, p.vertices))) : []
      const area = p.area - huecos.reduce((s, q) => s + areaPoligono(q.vertices).area, 0)
      return {
        descripcion: `${p.capa} ${k + 1}${huecos.length ? ` · menos ${huecos.length} hueco(s)` : ''}`,
        area: String(Math.round(area * 10000) / 10000),
        espesor,
        huella: [[p.vertices, ...huecos.map((q) => q.vertices)]],
      }
    })
    onAgregar(nuevas)
    setLista(null)
  }

  return (
    <div className="grid w-full gap-2 rounded-xl p-3 text-sm" style={{ border: '1px solid var(--cc-borde)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-cc-suave">{lista.archivo} · capa</span>
        <select value={capa} onChange={(e) => setCapa(e.target.value)}>
          {capas.map((c) => (
            <option key={c} value={c}>{c} ({lista.pols.filter((p) => p.capa === c).length})</option>
          ))}
        </select>
        {conEspesor && <span className="text-xs text-cc-suave">espesor a excavar</span>}
        {conEspesor && <Entrada value={espesor} onChange={(e) => setEspesor(e.target.value)} type="number" step="0.01" min="0" className="num" style={{ padding: '4px 8px', fontSize: 13, width: 70 }} />}
        <label className="flex items-center gap-1 text-xs text-cc-suave">
          <input type="checkbox" checked={restar} onChange={(e) => setRestar(e.target.checked)} />
          restar los que quedan dentro (huecos)
        </label>
      </div>
      <div className="grid max-h-48 gap-1 overflow-auto">
        {deCapa.map((p) => (
          <label key={p.id} className="num flex items-center gap-2 text-xs">
            <input type="checkbox" checked={elegidos.has(p.id)} onChange={() => alternar(p.id)} />
            {fmt(p.area)} m² · {p.nVertices} vértices · x {fmt(Math.min(...p.vertices.map((v) => v[0])))} y {fmt(Math.min(...p.vertices.map((v) => v[1])))}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Boton chico variante="pri" disabled={!elegidos.size} onClick={agregar}>Agregar {elegidos.size || ''}</Boton>
        <Boton chico onClick={() => setLista(null)}>Cancelar</Boton>
      </div>
    </div>
  )
}
