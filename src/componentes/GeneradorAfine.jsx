import { useEffect, useMemo, useState } from 'react'
import { analizarAfine, cepasDeExcavacion } from '../dominio/afine'
import { fmt, unidadTexto } from '../dominio/redondeo'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle } from '../lib/ui'
import ComoSeGenera from './ComoSeGenera'
import { Aviso, Boton, Campo, Entrada, Seccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')
const aTexto = (c) => ({ ...c, ml: texto(c.ml), ancho: texto(c.ancho), profundidad: texto(c.profundidad), piezas: texto(c.piezas) })

/**
 * Generador de afine y compactación de fondo y taludes: toma las cepas del análisis de
 * excavación del paquete y suma su fondo y sus dos paredes. No se vuelven a capturar medidas;
 * solo se pueden quitar cepas o corregir los ml del elemento.
 */
export default function GeneradorAfine({ concepto, generadores, puedeEscribir, onGuardado, onVolver, onCapturar }) {
  const excavaciones = generadores.filter((g) => g.tipo === 'excavacion' && g.datos?.renglones?.length)
  const [origenId, setOrigenId] = useState(null)
  const [cepas, setCepas] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const origen = excavaciones.find((g) => g.paquete_concepto_id === origenId) ?? excavaciones[0]

  useEffect(() => {
    let vivo = true
    repo
      .generador(concepto.id)
      .then((g) => {
        if (!vivo) return
        setGuardado(g)
        if (g?.datos?.cepas) {
          setCepas(g.datos.cepas.map(aTexto))
          setOrigenId(g.datos.origen?.paquete_concepto_id ?? null)
          setReferencia(g.datos.referencia != null ? texto(g.datos.referencia) : '')
        }
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id])

  // sin análisis guardado, las cepas salen directo de la excavación
  const datosOrigen = origen?.datos
  const lista = useMemo(() => cepas ?? (datosOrigen ? cepasDeExcavacion(datosOrigen).map(aTexto) : []), [cepas, datosOrigen])
  const entrada = useMemo(
    () => lista.map((c) => ({ ...c, ml: num(c.ml), ancho: num(c.ancho), profundidad: num(c.profundidad), piezas: num(c.piezas) || 1 })),
    [lista],
  )
  const r = useMemo(() => analizarAfine({ cepas: entrada }), [entrada])
  useEffect(() => {
    onCapturar?.('afine', { cepas: entrada }) // el 3D dibuja lo que se captura en tiempo real
  }, [entrada, onCapturar])
  const ref = num(referencia)
  const cuadra = ref > 0 && Math.abs(r.cantidad - ref) < 0.005
  const desactualizado =
    guardado?.datos?.origen?.actualizado_en && origen?.actualizado_en && new Date(origen.actualizado_en) > new Date(guardado.datos.origen.actualizado_en)

  const cambia = (i, k, v) => setCepas(lista.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const retomar = () => {
    if (origen) setCepas(cepasDeExcavacion(origen.datos).map(aTexto))
  }

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const datos = {
        origen: origen ? { paquete_concepto_id: origen.paquete_concepto_id, concepto: origen.concepto?.clave ?? null, actualizado_en: origen.actualizado_en ?? null } : null,
        cepas: entrada.map((c) => ({ elemento: c.elemento, eje: c.eje, entre: c.entre, ml: c.ml, ancho: c.ancho, profundidad: c.profundidad, piezas: c.piezas, desfase: c.desfase ?? null, inicio: c.inicio ?? null, incluir: c.incluir !== false })),
        referencia: ref > 0 ? ref : null,
      }
      const g = await repo.guardarGenerador(concepto.id, { tipo: 'afine', datos, cantidad: Math.round(r.total * 10000) / 10000, unidad: concepto.unidad, formula: r.formula })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis de afine guardado.' })
      onGuardado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: repo.mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  const celda = 'px-2 py-1.5'
  const numero = (valor, onChange, w = 76) => (
    <Entrada value={valor} disabled={!puedeEscribir} onChange={(e) => onChange(e.target.value)} type="number" step="0.01" min="0" className="num" style={{ padding: '6px 8px', fontSize: 13, width: w }} />
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · afine de fondo y taludes</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0].split('.')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}
      {!excavaciones.length && !cepas && <Aviso>Primero hay que guardar el análisis de excavación (método «Excavación por elementos»): de ahí salen las cepas que se afinan.</Aviso>}
      {desactualizado && (
        <Aviso>
          La excavación cambió después de guardar este afine.{' '}
          {puedeEscribir && (
            <Boton chico onClick={retomar}>
              Volver a tomar las cepas
            </Boton>
          )}
        </Aviso>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Tarjeta className="grid content-start gap-3 p-5">
            <Seccion>De dónde salen las cepas</Seccion>
            {excavaciones.length > 1 ? (
              <select value={origen?.paquete_concepto_id ?? ''} disabled={!puedeEscribir} onChange={(e) => { setOrigenId(e.target.value); setCepas(null) }}>
                {excavaciones.map((g) => (
                  <option key={g.paquete_concepto_id} value={g.paquete_concepto_id}>{g.concepto?.clave} · {fmt(g.cantidad)} m³</option>
                ))}
              </select>
            ) : (
              <p className="num text-sm">{origen ? `${origen.concepto?.clave ?? 'Excavación'} · ${fmt(origen.cantidad)} m³` : '—'}</p>
            )}
            <p className="text-xs text-cc-tenue">
              Ancho y profundidad de cada cepa vienen de la excavación (ya traen el sobreancho y la plantilla). Se afina el fondo y las dos paredes, también la del lindero. Las losas y el firme no entran: su afine es otro concepto.
            </p>
            {puedeEscribir && origen && cepas && <Boton chico onClick={retomar}>Volver a tomar de la excavación</Boton>}
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
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cepas que se afinan</Seccion>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    <th className={celda}>Entra</th>
                    <th className={celda}>Elemento</th>
                    <th className={celda}>Ubicación</th>
                    <th className={celda}>ml del elemento</th>
                    <th className={`${celda} text-right`}>Ancho cepa</th>
                    <th className={`${celda} text-right`}>Prof. cepa</th>
                    <th className={celda}>Cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c, i) => {
                    const f = r.filas[i]
                    const entra = c.incluir !== false
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)', opacity: entra ? 1 : 0.45 }}>
                        <td className={celda}>
                          <input type="checkbox" checked={entra} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'incluir', e.target.checked)} />
                        </td>
                        <td className={`${celda} num font-bold`}>{c.elemento}</td>
                        <td className={`${celda} num text-xs text-cc-suave`}>{[c.eje, c.entre].filter(Boolean).join(' · ')}</td>
                        <td className={celda}>{numero(c.ml, (v) => cambia(i, 'ml', v))}</td>
                        <td className={`${celda} num text-right`}>{fmt(f.ancho)}</td>
                        <td className={`${celda} num text-right`}>{fmt(f.profundidad)}</td>
                        <td className={`${celda} num text-xs`}>{f.valido ? f.formula : '—'}</td>
                      </tr>
                    )
                  })}
                  {!lista.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-sm text-cc-suave">Sin cepas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-xs text-cc-tenue" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              Área = ml × (ancho de la cepa + 2 × profundidad de la cepa). Se usan los ml del elemento del plano: en una esquina cuenta en los dos tramos.
            </p>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cálculo</Seccion>
            </div>
            <div className="grid gap-3 px-4 py-4 text-sm">
              {Object.keys(r.porElemento).length > 0 && (
                <table className="num w-full text-sm">
                  <thead>
                    <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                      <th className="py-1">Elemento</th>
                      <th className="py-1 text-right">ml</th>
                      <th className="py-1 text-right">m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.porElemento).map(([k, v]) => (
                      <tr key={k} style={{ borderTop: '1px solid var(--cc-borde)' }}>
                        <td className="py-1">{k}</td>
                        <td className="py-1 text-right">{fmt(v.ml)}</td>
                        <td className="py-1 text-right">{fmt(v.area)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
