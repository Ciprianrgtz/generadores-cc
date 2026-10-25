import { useEffect, useMemo, useState } from 'react'
import { analizarTerreno, UNIDADES_DXF, leerPoligonosDxf, validarPoligono } from '../dominio/terreno'
import { dato, fmt, unidadTexto } from '../dominio/redondeo'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle } from '../lib/ui'
import ComoSeGenera from './ComoSeGenera'
import { Aviso, Boton, BotonIcono, Campo, Entrada, Segmentos, Seccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')

/**
 * Generador de limpia y despalme (y de todo concepto que se mide por la superficie del terreno).
 * Volumen del concepto = superficie del terreno. El terreno se puede dar de tres maneras:
 *   · rectángulo: ancho × largo (lo normal en un terreno regular)
 *   · vértices: coordenadas en metros, para un terreno irregular
 *   · DXF: polilínea cerrada de AutoCAD, de preferencia en una capa llamada "terreno"
 */
export default function GeneradorTerreno({ concepto, proyecto, puedeEscribir, onGuardado, onVolver }) {
  const [modo, setModo] = useState('rectangulo')
  const [ancho, setAncho] = useState('')
  const [largo, setLargo] = useState('')
  const [vertices, setVertices] = useState([['', ''], ['', ''], ['', '']])
  const [origen, setOrigen] = useState(null) // { archivo, capa, unidad } si los vértices vienen de un DXF
  const [referencia, setReferencia] = useState('')
  const [dxf, setDxf] = useState(null) // { archivo, poligonos, unidad }
  const [leyendo, setLeyendo] = useState(false)
  const [guardado, setGuardado] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  // carga el análisis guardado de este concepto, o el terreno que el proyecto ya tiene
  useEffect(() => {
    let vivo = true
    repo
      .generador(concepto.id)
      .then((g) => {
        if (!vivo) return
        const d = g?.datos ?? (proyecto.terreno?.datos ?? null)
        setGuardado(g)
        if (!d) return
        setModo(d.modo === 'poligono' ? 'poligono' : 'rectangulo')
        setAncho(d.ancho != null ? texto(d.ancho) : '')
        setLargo(d.largo != null ? texto(d.largo) : '')
        if (d.vertices?.length) setVertices(d.vertices.map(([x, y]) => [texto(x), texto(y)]))
        setOrigen(d.origen ?? null)
        // la cantidad de Neodata es de cada concepto, no del terreno: solo se recupera si este concepto ya tenía análisis
        setReferencia(g && d.referencia != null ? texto(d.referencia) : '')
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id, proyecto.terreno])

  const numericos = useMemo(() => vertices.map(([x, y]) => [num(x), num(y)]), [vertices])
  const motivo = modo === 'rectangulo' ? (num(ancho) > 0 && num(largo) > 0 ? null : 'Escribe el ancho y el largo del terreno') : validarPoligono(numericos)
  const r = useMemo(
    () => (motivo ? null : analizarTerreno({ modo, ancho: num(ancho), largo: num(largo), vertices: numericos })),
    [motivo, modo, ancho, largo, numericos],
  )
  const ref = num(referencia)
  const cuadra = r && ref > 0 && Math.abs(r.area - ref) < 0.005

  async function leerDxf(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setLeyendo(true)
    setMensaje(null)
    try {
      const poligonos = leerPoligonosDxf(await archivo.text(), 1)
      if (!poligonos.length) throw new Error('No encontré polilíneas en ese DXF. Dibuja el terreno con una polilínea cerrada, en una capa llamada "terreno".')
      setDxf({ archivo: archivo.name, poligonos, unidad: 'm' })
    } catch (err) {
      setDxf(null)
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setLeyendo(false)
    }
  }

  function usarPoligono(p) {
    const f = UNIDADES_DXF[dxf.unidad]
    const pts = p.vertices.map(([x, y]) => [x * f, y * f])
    // se mueve a la esquina (0,0): el área no cambia y el visor 3D queda cerca del origen
    const minX = Math.min(...pts.map((q) => q[0]))
    const minY = Math.min(...pts.map((q) => q[1]))
    setVertices(pts.map(([x, y]) => [texto(x - minX), texto(y - minY)]))
    setOrigen({ archivo: dxf.archivo, capa: p.capa, unidad: dxf.unidad })
    setModo('poligono')
    setDxf(null)
  }

  const cambiaVertice = (i, j, v) => {
    setOrigen(null)
    setVertices((vs) => vs.map((p, k) => (k === i ? p.map((c, m) => (m === j ? v : c)) : p)))
  }

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const datos = { modo: modo === 'rectangulo' ? 'rectangulo' : 'poligono', ancho: num(ancho) || null, largo: num(largo) || null, vertices: r.vertices, origen, referencia: ref > 0 ? ref : null }
      const g = await repo.guardarGenerador(concepto.id, {
        tipo: 'terreno',
        datos,
        cantidad: Math.round(r.area * 10000) / 10000,
        unidad: concepto.unidad,
        formula: `Superficie del terreno = ${r.formula}`,
      })
      await repo.guardarTerreno(proyecto.id, { vertices: r.vertices, area: r.area, perimetro: r.perimetro, datos })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis guardado. El terreno ya está en el modelo 3D.' })
      onGuardado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: repo.mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · superficie del terreno</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Tarjeta className="grid content-start gap-4 p-5">
          <Seccion>¿Cómo se da el terreno?</Seccion>
          <Segmentos opciones={[['rectangulo', 'Rectángulo'], ['poligono', 'Vértices'], ['dxf', 'Importar DXF']]} valor={dxf || modo === 'dxf' ? 'dxf' : modo} onCambio={(m) => (m === 'dxf' ? setModo('dxf') : (setModo(m), setDxf(null)))} />

          {modo === 'rectangulo' && (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Ancho (m)">
                <Entrada type="number" step="0.01" min="0" value={ancho} placeholder="8.00" disabled={!puedeEscribir} onChange={(e) => setAncho(e.target.value)} className="num" />
              </Campo>
              <Campo etiqueta="Largo (m)">
                <Entrada type="number" step="0.01" min="0" value={largo} placeholder="20.00" disabled={!puedeEscribir} onChange={(e) => setLargo(e.target.value)} className="num" />
              </Campo>
            </div>
          )}

          {modo === 'poligono' && (
            <div className="grid gap-2">
              <p className="text-xs text-cc-suave">
                Vértices en orden, dando la vuelta al terreno, con coordenadas en metros.
                {origen && <> Vienen de <b className="text-cc-texto">{origen.archivo}</b> (capa {origen.capa}).</>}
              </p>
              <div className="grid grid-cols-[28px_1fr_1fr_28px] items-center gap-2 text-xs text-cc-tenue">
                <span>#</span><span>X (m)</span><span>Y (m)</span><span></span>
              </div>
              {vertices.map(([x, y], i) => (
                <div key={i} className="grid grid-cols-[28px_1fr_1fr_28px] items-center gap-2">
                  <span className="num text-xs text-cc-suave">{i + 1}</span>
                  <Entrada type="number" step="0.01" value={x} disabled={!puedeEscribir} onChange={(e) => cambiaVertice(i, 0, e.target.value)} className="num" />
                  <Entrada type="number" step="0.01" value={y} disabled={!puedeEscribir} onChange={(e) => cambiaVertice(i, 1, e.target.value)} className="num" />
                  <BotonIcono peligro title="Quitar vértice" disabled={!puedeEscribir || vertices.length <= 3} onClick={() => setVertices((vs) => vs.filter((_, k) => k !== i))}>✕</BotonIcono>
                </div>
              ))}
              <Boton chico disabled={!puedeEscribir} onClick={() => setVertices((vs) => [...vs, ['', '']])}>+ Vértice</Boton>
            </div>
          )}

          {modo === 'dxf' && (
            <div className="grid gap-3">
              <p className="text-xs text-cc-suave">
                En AutoCAD dibuja el terreno con una <b className="text-cc-texto">polilínea cerrada</b> en una capa llamada <b className="text-cc-texto">terreno</b> y guarda como DXF.
              </p>
              <label className="inline-flex w-fit cursor-pointer items-center" style={{ background: 'var(--cc-superficie)', color: 'var(--cc-suave)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 600, boxShadow: '3px 3px 8px var(--cc-sombra), -2px -2px 6px var(--cc-luz)' }}>
                {leyendo ? 'Leyendo el DXF…' : 'Elegir archivo .dxf'}
                <input type="file" accept=".dxf" className="hidden" onChange={leerDxf} disabled={!puedeEscribir || leyendo} />
              </label>
              {dxf && (
                <div className="grid gap-2">
                  <Campo etiqueta="Unidad en que está dibujado el DXF">
                    <div>
                      <Segmentos opciones={[['m', 'metros'], ['cm', 'centímetros'], ['mm', 'milímetros']]} valor={dxf.unidad} onCambio={(u) => setDxf({ ...dxf, unidad: u })} />
                    </div>
                  </Campo>
                  <p className="text-xs text-cc-suave">{dxf.poligonos.length} polilíneas en <b className="text-cc-texto">{dxf.archivo}</b>. Elige la del terreno:</p>
                  <ul className="grid max-h-64 gap-1.5 overflow-auto">
                    {dxf.poligonos.slice(0, 40).map((p, i) => {
                      const f = UNIDADES_DXF[dxf.unidad]
                      const esTerreno = /terreno|predio|lote/i.test(p.capa)
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => usarPoligono(p)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm"
                            style={{ background: esTerreno ? 'rgba(29,158,117,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${esTerreno ? 'rgba(29,158,117,0.35)' : 'var(--cc-borde)'}`, color: 'var(--cc-texto)', cursor: 'pointer' }}
                          >
                            <b className="num">{fmt(p.area * f * f)} m²</b>
                            <span className="text-xs text-cc-suave">capa {p.capa} · {p.nVertices} vértices{p.cerrada ? '' : ' · abierta'}</span>
                            {esTerreno && <span className="ml-auto text-[10px] font-bold uppercase" style={{ color: '#3ddba6' }}>terreno</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Campo etiqueta="Cantidad que trae Neodata (m²), para comparar">
            <Entrada type="number" step="0.01" min="0" value={referencia} disabled={!puedeEscribir} onChange={(e) => setReferencia(e.target.value)} className="num" placeholder="opcional" />
          </Campo>
        </Tarjeta>

        <div className="grid min-w-0 content-start gap-4">
          <ComoSeGenera concepto={concepto} generador={guardado} terreno={proyecto.terreno} compacto />
          <Tarjeta className="p-4">
            {r ? <PlanoTerreno r={r} /> : <p className="py-10 text-center text-sm text-cc-suave">{motivo ?? 'Captura el terreno para ver el dibujo.'}</p>}
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cálculo</Seccion>
            </div>
            {r ? (
              <div className="grid gap-3 px-4 py-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-cc-suave">Superficie del terreno</span>
                  <span className="num text-cc-suave">{r.formula}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-cc-suave">Perímetro</span>
                  <span className="num text-cc-suave">{fmt(r.perimetro)} m</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(29,158,117,0.14)', border: '1px solid rgba(29,158,117,0.35)' }}>
                  <b>Cantidad del generador · {concepto.clave}</b>
                  <b className="num text-lg" style={{ color: '#3ddba6' }}>{fmt(r.area)} {unidadTexto(concepto.unidad)}</b>
                </div>
                {ref > 0 && (
                  <div style={{ ...avisoStyle(cuadra ? 'verde' : 'ambar'), padding: '10px 14px' }}>
                    <b style={{ color: cuadra ? '#34d399' : '#f0b866' }}>{cuadra ? '✓ Cuadra con Neodata' : '≠ No cuadra con Neodata'}</b>
                    <span className="num ml-2 text-cc-suave">
                      generador {fmt(r.area)} · Neodata {fmt(ref)}
                      {!cuadra && ` · Δ ${fmt(r.area - ref)} ${unidadTexto(concepto.unidad)}`}
                    </span>
                    {!cuadra && <p className="mt-1 text-xs text-cc-suave">Revisa si el presupuesto usó la superficie del terreno o solo la de construcción.</p>}
                  </div>
                )}
                {r.terminos && (
                  <details className="text-xs text-cc-suave">
                    <summary className="cursor-pointer">Ver los términos de la fórmula (lazada)</summary>
                    <table className="num mt-2 w-full">
                      <tbody>
                        {r.terminos.map((t) => (
                          <tr key={t.de} style={{ borderTop: '1px solid var(--cc-borde)' }}>
                            <td className="py-1">{t.de} → {t.a}</td>
                            <td>{t.texto}</td>
                            <td className="text-right">{fmt(t.valor, 3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-cc-suave">{motivo}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              <Boton variante="pri" disabled={!puedeEscribir || !r || ocupado} onClick={guardar}>
                {guardado ? 'Guardar cambios del análisis' : 'Guardar análisis'}
              </Boton>
              {guardado && <span className="text-xs text-cc-suave">Guardado: {fmt(guardado.cantidad)} {unidadTexto(concepto.unidad)} · {new Date(guardado.actualizado_en).toLocaleString('es-MX')}</span>}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}

/** Dibujo a escala del terreno con la longitud de cada lado y el número de cada vértice. */
function PlanoTerreno({ r }) {
  const v = r.vertices
  const xs = v.map((p) => p[0])
  const ys = v.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  const s = Math.min(520 / w, 280 / h)
  const m = 60
  const X = (x) => m + (x - minX) * s
  const Y = (y) => m + (maxY - y) * s // el norte (Y) queda hacia arriba
  const cx = v.reduce((a, p) => a + p[0], 0) / v.length
  const cy = v.reduce((a, p) => a + p[1], 0) / v.length

  return (
    <svg viewBox={`0 0 ${w * s + 2 * m} ${h * s + 2 * m}`} className="w-full" style={{ maxHeight: 360 }} role="img" aria-label="Dibujo a escala del terreno">
      <polygon points={v.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} fill="rgba(29,158,117,0.16)" stroke="#3ddba6" strokeWidth="2" strokeLinejoin="round" />
      {v.map(([x1, y1], i) => {
        const [x2, y2] = v[(i + 1) % v.length]
        const L = Math.hypot(x2 - x1, y2 - y1)
        const mx = (X(x1) + X(x2)) / 2
        const my = (Y(y1) + Y(y2)) / 2
        // la etiqueta se separa del lado, hacia afuera del centro del terreno
        const dx = mx - X(cx)
        const dy = my - Y(cy)
        const d = Math.hypot(dx, dy) || 1
        return (
          <text key={i} x={mx + (dx / d) * 22} y={my + (dy / d) * 22 + 4} textAnchor="middle" fontSize="12" className="num fill-cc-suave">
            {dato(L)} m
          </text>
        )
      })}
      {v.map(([x, y], i) => (
        <g key={i}>
          <circle cx={X(x)} cy={Y(y)} r="4" fill="#3ddba6" />
          <text x={X(x) + (X(x) > X(cx) ? 8 : -8)} y={Y(y) + (Y(y) > Y(cy) ? 16 : -8)} textAnchor={X(x) > X(cx) ? 'start' : 'end'} fontSize="10" className="num fill-cc-tenue">{i + 1}</text>
        </g>
      ))}
      <text x={X(cx)} y={Y(cy) + 5} textAnchor="middle" fontSize="18" fontWeight="700" className="num fill-cc-texto">{fmt(r.area)} m²</text>
    </svg>
  )
}
