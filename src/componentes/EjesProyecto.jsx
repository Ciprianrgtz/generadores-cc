import { useEffect, useMemo, useState } from 'react'
import { ejesAlOrigen, leerEjesDxf } from '../dominio/ejes'
import { UNIDADES_DXF } from '../dominio/terreno'
import { fmt } from '../dominio/redondeo'
import * as repo from '../lib/proyectosRepo'
import { botones } from '../lib/ui'
import { Aviso, Boton, BotonIcono, Entrada, Seccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const aTexto = (lista = []) => lista.map((e) => ({ nombre: e.nombre, pos: String(e.pos) }))
const limpiar = (lista) =>
  lista
    .map((e) => ({ nombre: e.nombre.trim().toUpperCase(), pos: num(e.pos) }))
    .filter((e) => e.nombre && Number.isFinite(e.pos))
    .sort((a, b) => a.pos - b.pos)

/**
 * Ejes del proyecto: el sistema de coordenadas de la obra. Se importan del DXF (eligiendo la planta)
 * o se capturan a mano. Lo que se captura se dibuja en el 3D en tiempo real (onCapturar).
 */
export default function EjesProyecto({ proyecto, puedeEscribir, onGuardado, onCapturar }) {
  const guardados = proyecto.ejes
  const [abierto, setAbierto] = useState(!guardados?.verticales?.length)
  const [vert, setVert] = useState(aTexto(guardados?.verticales))
  const [hori, setHori] = useState(aTexto(guardados?.horizontales))
  const [origenDxf, setOrigenDxf] = useState(guardados?.origen_dxf ?? null)
  const [unidad, setUnidad] = useState('m')
  const [plantas, setPlantas] = useState(null) // lo que se encontró en el DXF
  const [alOrigen, setAlOrigen] = useState(true)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const ejes = useMemo(() => ({ verticales: limpiar(vert), horizontales: limpiar(hori), origen_dxf: origenDxf }), [vert, hori, origenDxf])
  const cambio = JSON.stringify(ejes) !== JSON.stringify({ verticales: guardados?.verticales ?? [], horizontales: guardados?.horizontales ?? [], origen_dxf: guardados?.origen_dxf ?? null })

  useEffect(() => {
    onCapturar?.(cambio ? ejes : null) // el 3D muestra los ejes que se están capturando
  }, [ejes, cambio, onCapturar])

  async function leerDxf(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setMensaje(null)
    setOcupado(true)
    try {
      const encontradas = leerEjesDxf(await archivo.text(), UNIDADES_DXF[unidad])
      if (!encontradas.length) throw new Error('No encontré ejes en el DXF: se buscan textos de eje (X-00, A, 1…) junto a líneas de una capa que diga «eje».')
      setPlantas({ archivo: archivo.name, lista: encontradas })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupado(false)
    }
  }

  function usar(planta) {
    const p = alOrigen ? ejesAlOrigen(planta) : { ...planta, origen_dxf: { x: 0, y: 0 } }
    setVert(aTexto(p.verticales))
    setHori(aTexto(p.horizontales))
    setOrigenDxf(p.origen_dxf)
    setPlantas(null)
    setMensaje({ tipo: 'ok', texto: `Ejes tomados de ${plantas.archivo}. Revisa y guarda.` })
  }

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      await repo.guardarEjes(proyecto.id, ejes)
      setMensaje({ tipo: 'ok', texto: 'Ejes guardados.' })
      onGuardado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: repo.mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  const resumen = (l) => (l.length ? `${l[0].nombre} … ${l[l.length - 1].nombre} (${l.length})` : '—')
  const tabla = (titulo, lista, set) => (
    <div className="grid content-start gap-1.5">
      <b className="text-xs text-cc-suave">{titulo}</b>
      {lista.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Entrada value={e.nombre} disabled={!puedeEscribir} onChange={(ev) => set(lista.map((x, j) => (j === i ? { ...x, nombre: ev.target.value } : x)))} className="num" style={{ padding: '5px 8px', fontSize: 13, width: 80 }} placeholder="X-00" />
          <Entrada value={e.pos} disabled={!puedeEscribir} onChange={(ev) => set(lista.map((x, j) => (j === i ? { ...x, pos: ev.target.value } : x)))} type="number" step="0.01" className="num" style={{ padding: '5px 8px', fontSize: 13, width: 90 }} placeholder="0.00" />
          {puedeEscribir && (
            <BotonIcono peligro title="Quitar eje" onClick={() => set(lista.filter((_, j) => j !== i))}>
              ×
            </BotonIcono>
          )}
        </div>
      ))}
      {puedeEscribir && (
        <Boton chico className="w-fit" onClick={() => set([...lista, { nombre: '', pos: '' }])}>
          + Eje
        </Boton>
      )}
    </div>
  )

  return (
    <Tarjeta className="overflow-hidden">
      <button type="button" className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left" onClick={() => setAbierto(!abierto)}>
        <Seccion>Ejes del proyecto</Seccion>
        <span className="num text-xs text-cc-suave">
          Verticales {resumen(ejes.verticales)} · Horizontales {resumen(ejes.horizontales)}
        </span>
        {cambio && <span className="text-xs" style={{ color: '#f0b866' }}>sin guardar</span>}
        <span className="ml-auto text-xs text-cc-tenue">{abierto ? 'Ocultar ▲' : 'Editar ▼'}</span>
      </button>
      {abierto && (
        <div className="grid gap-4 px-4 pb-4" style={{ borderTop: '1px solid var(--cc-borde)' }}>
          <p className="pt-3 text-xs text-cc-suave">
            Los ejes son las coordenadas de la obra, en metros: cada renglón de un generador se ubica con su eje y entre qué ejes va, y así se dibuja solo. Verticales: corren a lo largo (su posición es x). Horizontales: corren a lo ancho (su posición es y).
          </p>
          {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center" style={{ ...botones.sec, ...(puedeEscribir && !ocupado ? null : { pointerEvents: 'none', opacity: 0.4 }) }}>
              Importar ejes de un DXF
              <input type="file" accept=".dxf" className="hidden" onChange={leerDxf} disabled={!puedeEscribir || ocupado} />
            </label>
            <span className="text-xs text-cc-suave">Unidades del dibujo:</span>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} disabled={!puedeEscribir}>
              {Object.keys(UNIDADES_DXF).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-cc-suave">
              <input type="checkbox" checked={alOrigen} onChange={(e) => setAlOrigen(e.target.checked)} />
              Poner el 0,0 en el primer eje de cada sentido
            </label>
          </div>

          {plantas && (
            <div className="grid gap-2 rounded-xl p-3 text-sm" style={{ border: '1px solid var(--cc-borde)' }}>
              <span className="text-xs text-cc-suave">
                En <b className="text-cc-texto">{plantas.archivo}</b> hay {plantas.lista.length} planta(s) de ejes. Elige una:
              </span>
              {plantas.lista.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3">
                  <span className="num text-xs">
                    {p.verticales.map((e) => e.nombre).join(', ')} · {p.horizontales.map((e) => e.nombre).join(', ')} · {fmt(p.verticales.at(-1).pos - p.verticales[0].pos)} × {fmt(p.horizontales.at(-1).pos - p.horizontales[0].pos)} m
                  </span>
                  <Boton chico variante="pri" onClick={() => usar(p)}>Usar esta</Boton>
                </div>
              ))}
              <Boton chico className="w-fit" onClick={() => setPlantas(null)}>Cancelar</Boton>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {tabla('Verticales (posición x)', vert, setVert)}
            {tabla('Horizontales (posición y)', hori, setHori)}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="pri" disabled={!puedeEscribir || !cambio || ocupado} onClick={guardar}>
              Guardar ejes
            </Boton>
            {cambio && (
              <Boton
                disabled={ocupado}
                onClick={() => {
                  setVert(aTexto(guardados?.verticales))
                  setHori(aTexto(guardados?.horizontales))
                  setOrigenDxf(guardados?.origen_dxf ?? null)
                }}
              >
                Deshacer
              </Boton>
            )}
          </div>
        </div>
      )}
    </Tarjeta>
  )
}
