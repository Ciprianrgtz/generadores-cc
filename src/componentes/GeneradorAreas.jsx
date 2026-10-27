import { useEffect, useMemo, useState } from 'react'
import { analizarAreas, areasDeExcavacion } from '../dominio/areas'
import { fmt, unidadTexto } from '../dominio/redondeo'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle } from '../lib/ui'
import ComoSeGenera from './ComoSeGenera'
import ImportarSuperficies from './ImportarSuperficies'
import { Aviso, Boton, BotonIcono, Campo, Entrada, Seccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')
const aTexto = (a) => ({ ...a, area: texto(a.area) })
const AREA_VACIA = { descripcion: '', area: '', huella: null, origen: 'a mano', incluir: true }

/**
 * Generador de suma de áreas (membrana, afine para firme, firmes…): se eligen las áreas que entran
 * — de la excavación, de un DXF o a mano — y se suman. Lo que se elige se dibuja en el 3D al momento.
 */
export default function GeneradorAreas({ concepto, ejes, generadores, puedeEscribir, onGuardado, onVolver, onCapturar }) {
  const excavaciones = generadores.filter((g) => g.tipo === 'excavacion' && g.datos?.superficies?.length)
  const [areas, setAreas] = useState([])
  const [referencia, setReferencia] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    repo
      .generador(concepto.id)
      .then((g) => {
        if (!vivo) return
        setGuardado(g)
        if (g?.datos?.areas) {
          setAreas(g.datos.areas.map(aTexto))
          setReferencia(g.datos.referencia != null ? texto(g.datos.referencia) : '')
        }
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id])

  const entrada = useMemo(() => areas.map((a) => ({ ...a, area: num(a.area) })), [areas])
  const r = useMemo(() => analizarAreas({ areas: entrada }), [entrada])
  useEffect(() => {
    onCapturar?.('areas', { areas: entrada }) // el 3D dibuja lo que se elige en tiempo real
  }, [entrada, onCapturar])
  const ref = num(referencia)
  const cuadra = ref > 0 && Math.abs(r.cantidad - ref) < 0.005

  const cambia = (i, k, v) => setAreas((xs) => xs.map((a, j) => (j === i ? { ...a, [k]: v } : a)))
  const tomarDe = (g) => setAreas((xs) => [...xs, ...areasDeExcavacion(g.datos, g.concepto?.clave).map(aTexto)])

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const datos = {
        areas: entrada.filter((a) => a.descripcion || a.area > 0).map((a) => ({ descripcion: a.descripcion, area: Number.isFinite(a.area) ? a.area : null, nivel: a.nivel ?? null, huella: a.huella ?? null, origen: a.origen ?? null, incluir: a.incluir !== false })),
        referencia: ref > 0 ? ref : null,
      }
      const g = await repo.guardarGenerador(concepto.id, { tipo: 'areas', datos, cantidad: Math.round(r.total * 10000) / 10000, unidad: concepto.unidad, formula: r.formula })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis guardado.' })
      onGuardado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: repo.mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  const celda = 'px-2 py-1.5'

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · suma de áreas</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0].split('.')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Tarjeta className="grid content-start gap-3 p-5">
            <Seccion>De dónde salen las áreas</Seccion>
            {excavaciones.map((g) => (
              <Boton key={g.paquete_concepto_id} chico disabled={!puedeEscribir} onClick={() => tomarDe(g)}>
                Tomar las superficies de {g.concepto?.clave ?? 'la excavación'}
              </Boton>
            ))}
            {!excavaciones.length && <p className="text-xs text-cc-suave">La excavación no tiene superficies (losas, firmes) que tomar.</p>}
            <p className="text-xs text-cc-tenue">
              De la excavación se toma el área dibujada completa de cada superficie (no la neta de excavación). También se pueden importar polígonos de un DXF o capturar áreas a mano.
            </p>
          </Tarjeta>
          <Tarjeta className="grid content-start gap-3 p-5">
            <Campo etiqueta={`Cantidad que trae Neodata (${unidadTexto(concepto.unidad)}), para comparar`}>
              <Entrada value={referencia} disabled={!puedeEscribir} onChange={(e) => setReferencia(e.target.value)} type="number" step="0.01" min="0" className="num" placeholder="opcional" />
            </Campo>
          </Tarjeta>
          <ComoSeGenera concepto={concepto} generador={guardado} compacto />
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Tarjeta className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Áreas</Seccion>
              {puedeEscribir && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <ImportarSuperficies ejes={ejes} conEspesor={false} onAgregar={(nuevas) => setAreas((xs) => [...xs, ...nuevas.map((n) => ({ ...n, origen: 'DXF', incluir: true }))])} />
                  <Boton chico onClick={() => setAreas((xs) => [...xs, { ...AREA_VACIA }])}>+ Área</Boton>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    <th className={celda}>Entra</th>
                    <th className={celda}>Descripción</th>
                    <th className={celda}>De</th>
                    <th className={celda}>Área (m²)</th>
                    <th className={celda}>3D</th>
                    <th className={celda}></th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)', opacity: a.incluir !== false ? 1 : 0.45 }}>
                      <td className={celda}>
                        <input type="checkbox" checked={a.incluir !== false} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'incluir', e.target.checked)} />
                      </td>
                      <td className={celda}>
                        <Entrada value={a.descripcion} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'descripcion', e.target.value)} style={{ padding: '6px 8px', fontSize: 13, minWidth: 260 }} />
                      </td>
                      <td className={`${celda} text-xs text-cc-suave`}>{a.origen}</td>
                      <td className={celda}>
                        <Entrada value={a.area} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'area', e.target.value)} type="number" step="0.01" min="0" className="num" style={{ padding: '6px 8px', fontSize: 13, width: 90 }} />
                      </td>
                      <td className={`${celda} text-center`} title={a.huella?.length ? 'Se dibuja con su forma' : 'Sin forma: suma pero no se dibuja'} style={{ color: a.huella?.length ? '#3ddba6' : '#f0b866' }}>
                        {a.huella?.length ? '●' : '○'}
                      </td>
                      <td className={celda}>
                        {puedeEscribir && (
                          <BotonIcono peligro title="Quitar área" onClick={() => setAreas((xs) => xs.filter((_, j) => j !== i))}>
                            ×
                          </BotonIcono>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!areas.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm text-cc-suave">
                        Sin áreas. Toma las superficies de la excavación, importa un DXF o agrega una a mano.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cálculo</Seccion>
            </div>
            <div className="grid gap-3 px-4 py-4 text-sm">
              <span className="num text-xs text-cc-suave">{r.formula}</span>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(29,158,117,0.14)', border: '1px solid rgba(29,158,117,0.35)' }}>
                <b>Cantidad del generador · {concepto.clave}</b>
                <b className="num text-lg" style={{ color: '#3ddba6' }}>
                  {fmt(r.total)} {unidadTexto(concepto.unidad)}
                </b>
              </div>
              {ref > 0 && r.total > 0 && (
                <div style={{ ...avisoStyle(cuadra ? 'verde' : 'ambar'), padding: '10px 14px' }}>
                  <b style={{ color: cuadra ? '#34d399' : '#f0b866' }}>{cuadra ? '✓ Cuadra con Neodata' : '≠ No cuadra con Neodata'}</b>
                  <span className="num ml-2 text-cc-suave">
                    generador {fmt(r.total)} · Neodata {fmt(ref)}
                    {!cuadra && ` · Δ ${fmt(r.total - ref)} ${unidadTexto(concepto.unidad)}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              <Boton variante="pri" disabled={!puedeEscribir || !(r.total > 0) || ocupado} onClick={guardar}>
                {guardado ? 'Guardar cambios del análisis' : 'Guardar análisis'}
              </Boton>
              {guardado && (
                <span className="text-xs text-cc-suave">
                  Guardado: {fmt(guardado.cantidad)} {unidadTexto(concepto.unidad)} · {new Date(guardado.actualizado_en).toLocaleString('es-MX')}
                </span>
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
