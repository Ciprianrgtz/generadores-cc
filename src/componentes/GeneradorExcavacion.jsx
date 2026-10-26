import { useEffect, useMemo, useState } from 'react'
import { analizarExcavacion, CRITERIOS_EXCAVACION } from '../dominio/excavacion'
import { fmt, unidadTexto } from '../dominio/redondeo'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle } from '../lib/ui'
import ComoSeGenera from './ComoSeGenera'
import { Aviso, Boton, BotonIcono, Campo, Entrada, Seccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')

const RENGLON_VACIO = { elemento: '', eje: '', entre: '', largo: '', ancho: '', profundidad: '', piezas: '1' }
const FRANJA_VACIA = { descripcion: '', largo: '', separacion: '', profundidad: '' }

// Tramos de zapata corrida de Casa Bielva medidos en el DXF estructural (capa PROYECCIÓN DE ZAPATA).
// Desplante a −0.80 desde el terreno natural (NDZC −0.80). Ancho total de la sección: 0.80 (la zapata).
const ZC_BIELVA = [
  ['ZC-01', 'Y-00', 'X-00 a X-01', 4.82],
  ['ZC-01', 'Y-00', 'X-05 a X-06', 4.6],
  ['ZC-01', 'Y-04', 'X-00 a X-01', 4.97],
  ['ZC-02', 'Y-04', 'X-01 a X-02', 0.85],
  ['ZC-01', 'Y-04', 'X-06 a X-08', 4.76],
  ['ZC-01', 'X-08', 'Y-03 a Y-04', 2.56],
].map(([elemento, eje, entre, largo]) => ({ elemento, eje, entre, largo: texto(largo), ancho: '0.8', profundidad: '0.8', piezas: '1' }))

const aTexto = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? texto(v) : (v ?? '')]))

/**
 * Generador de excavación por elementos: un renglón por tramo de cada elemento que toca el suelo.
 * Volumen = largo × (ancho total + 2·sobreancho) × (desplante + plantilla) × piezas,
 * más las franjas de tierra menores a la separación mínima entre cepas.
 */
export default function GeneradorExcavacion({ concepto, proyecto, puedeEscribir, onGuardado, onVolver }) {
  const [criterios, setCriterios] = useState(aTexto(CRITERIOS_EXCAVACION))
  const [renglones, setRenglones] = useState([{ ...RENGLON_VACIO }])
  const [franjas, setFranjas] = useState([])
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
        const d = g?.datos
        if (!d?.renglones) return
        setCriterios(aTexto({ ...CRITERIOS_EXCAVACION, ...d.criterios }))
        setRenglones(d.renglones.length ? d.renglones.map(aTexto) : [{ ...RENGLON_VACIO }])
        setFranjas((d.separaciones ?? []).map(aTexto))
        setReferencia(d.referencia != null ? texto(d.referencia) : '')
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id])

  const entrada = useMemo(
    () => ({
      criterios: { sobreancho: num(criterios.sobreancho) || 0, plantilla: num(criterios.plantilla) || 0, separacionMinima: num(criterios.separacionMinima) || 0 },
      renglones: renglones.map((r) => ({ elemento: r.elemento.trim(), eje: r.eje.trim(), entre: r.entre.trim(), largo: num(r.largo), ancho: num(r.ancho), profundidad: num(r.profundidad), piezas: num(r.piezas) || 1 })),
      separaciones: franjas.map((s) => ({ descripcion: s.descripcion.trim(), largo: num(s.largo), separacion: num(s.separacion), profundidad: num(s.profundidad) })),
    }),
    [criterios, renglones, franjas],
  )
  const r = useMemo(() => analizarExcavacion(entrada), [entrada])
  const ref = num(referencia)
  const cuadra = ref > 0 && Math.abs(r.cantidad - ref) < 0.005
  const hayValidos = r.filas.some((f) => f.valido)
  const incompletos = r.filas.filter((f) => !f.valido && (f.largo || f.ancho || f.profundidad)).length

  const cambia = (set) => (i, k, v) => set((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const cambiaRenglon = cambia(setRenglones)
  const cambiaFranja = cambia(setFranjas)

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const limpio = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number.isFinite(v) ? v : typeof v === 'string' ? v : null]))
      const datos = {
        criterios: entrada.criterios,
        renglones: entrada.renglones.filter((x) => x.largo || x.ancho || x.profundidad || x.elemento).map(limpio),
        separaciones: entrada.separaciones.filter((x) => x.largo || x.separacion).map(limpio),
        relleno_franjas: Math.round(r.rellenoFranjas * 10000) / 10000,
        referencia: ref > 0 ? ref : null,
      }
      const g = await repo.guardarGenerador(concepto.id, {
        tipo: 'excavacion',
        datos,
        cantidad: Math.round(r.total * 10000) / 10000,
        unidad: concepto.unidad,
        formula: r.formula,
      })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis de excavación guardado.' })
      onGuardado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: repo.mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  const celda = 'px-2 py-1.5'
  const inp = (valor, onChange, props = {}) => (
    <Entrada value={valor} disabled={!puedeEscribir} onChange={(e) => onChange(e.target.value)} style={{ padding: '6px 8px', fontSize: 13 }} {...props} />
  )
  const numero = (valor, onChange, w = 76) => inp(valor, onChange, { type: 'number', step: '0.01', min: '0', className: 'num', style: { padding: '6px 8px', fontSize: 13, width: w } })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · excavación por elementos</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Tarjeta className="grid content-start gap-3 p-5">
            <Seccion>Criterios de la oficina</Seccion>
            <Campo etiqueta="Sobreancho por lado (m)">
              {inp(criterios.sobreancho, (v) => setCriterios({ ...criterios, sobreancho: v }), { type: 'number', step: '0.01', min: '0', className: 'num' })}
            </Campo>
            <Campo etiqueta="Plantilla bajo el elemento (m)">
              {inp(criterios.plantilla, (v) => setCriterios({ ...criterios, plantilla: v }), { type: 'number', step: '0.01', min: '0', className: 'num' })}
            </Campo>
            <Campo etiqueta="Separación mínima de tierra entre cepas (m)">
              {inp(criterios.separacionMinima, (v) => setCriterios({ ...criterios, separacionMinima: v }), { type: 'number', step: '0.01', min: '0', className: 'num' })}
            </Campo>
            <p className="text-xs text-cc-tenue">
              Se excava el ancho total del elemento en corte (no su forma) hasta su desplante. El sobreancho da espacio para armar, colar y amarrar.
            </p>
          </Tarjeta>
          <Tarjeta className="grid content-start gap-3 p-5">
            <Campo etiqueta={`Cantidad que trae Neodata (${unidadTexto(concepto.unidad)}), para comparar`}>
              {inp(referencia, setReferencia, { type: 'number', step: '0.01', min: '0', className: 'num', placeholder: 'opcional' })}
            </Campo>
          </Tarjeta>
          <ComoSeGenera concepto={concepto} generador={guardado} compacto />
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Tarjeta className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Elementos que tocan el suelo</Seccion>
              <div className="ml-auto flex flex-wrap gap-2">
                {puedeEscribir && proyecto.clave === 'BIELVA' && !renglones.some((x) => /^ZC/i.test(x.elemento)) && (
                  <Boton chico onClick={() => setRenglones((xs) => [...xs.filter((x) => x.elemento || x.largo), ...ZC_BIELVA])}>
                    Precargar zapatas corridas del DXF
                  </Boton>
                )}
                {puedeEscribir && <Boton chico onClick={() => setRenglones((xs) => [...xs, { ...RENGLON_VACIO }])}>+ Renglón</Boton>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    <th className={celda}>Elemento</th>
                    <th className={celda}>Eje</th>
                    <th className={celda}>Entre</th>
                    <th className={celda}>Largo</th>
                    <th className={celda}>Ancho total</th>
                    <th className={celda}>Desplante</th>
                    <th className={celda}>Pzas</th>
                    <th className={`${celda} text-right`}>m³</th>
                    <th className={celda}></th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((x, i) => {
                    const f = r.filas[i]
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)' }} title={f?.valido ? f.formula : 'Faltan largo, ancho o desplante'}>
                        <td className={celda}>{inp(x.elemento, (v) => cambiaRenglon(i, 'elemento', v), { placeholder: 'ZC-01', className: 'num', style: { padding: '6px 8px', fontSize: 13, width: 84 }, list: 'tipos-elemento' })}</td>
                        <td className={celda}>{inp(x.eje, (v) => cambiaRenglon(i, 'eje', v), { placeholder: 'Y-00', className: 'num', style: { padding: '6px 8px', fontSize: 13, width: 70 } })}</td>
                        <td className={celda}>{inp(x.entre, (v) => cambiaRenglon(i, 'entre', v), { placeholder: 'X-00 a X-01', className: 'num', style: { padding: '6px 8px', fontSize: 13, width: 110 } })}</td>
                        <td className={celda}>{numero(x.largo, (v) => cambiaRenglon(i, 'largo', v))}</td>
                        <td className={celda}>{numero(x.ancho, (v) => cambiaRenglon(i, 'ancho', v))}</td>
                        <td className={celda}>{numero(x.profundidad, (v) => cambiaRenglon(i, 'profundidad', v))}</td>
                        <td className={celda}>{numero(x.piezas, (v) => cambiaRenglon(i, 'piezas', v), 56)}</td>
                        <td className={`${celda} num text-right`} style={{ color: f?.valido ? 'var(--cc-texto)' : 'var(--cc-tenue)' }}>{f?.valido ? fmt(f.volumen) : '—'}</td>
                        <td className={celda}>
                          {puedeEscribir && (
                            <BotonIcono peligro title="Quitar renglón" onClick={() => setRenglones((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [{ ...RENGLON_VACIO }]))}>
                              ×
                            </BotonIcono>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <datalist id="tipos-elemento">
                {['ZC-01', 'ZC-02', 'CT-1', 'CT-2', 'TL-1', 'DD-1', 'Z-1', 'Plantilla'].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <p className="px-4 py-2 text-xs text-cc-tenue" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              Desplante: profundidad desde el terreno natural hasta el fondo del elemento, sin la plantilla (se suma sola). Pasa el cursor sobre un renglón para ver su cálculo.
              {incompletos > 0 && <span style={{ color: '#f0b866' }}> · {incompletos} renglón(es) incompleto(s) no suman.</span>}
            </p>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <div>
                <Seccion>Franjas de tierra entre cepas</Seccion>
                <p className="text-xs text-cc-tenue">Si quedan menos de {fmt(entrada.criterios.separacionMinima)} m de tierra entre dos cepas, la franja se excava y se rellena.</p>
              </div>
              {puedeEscribir && (
                <Boton chico className="ml-auto" onClick={() => setFranjas((xs) => [...xs, { ...FRANJA_VACIA }])}>
                  + Franja
                </Boton>
              )}
            </div>
            {franjas.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                      <th className={celda}>Entre qué cepas</th>
                      <th className={celda}>Largo</th>
                      <th className={celda}>Separación</th>
                      <th className={celda}>Profundidad</th>
                      <th className={celda}>Resultado</th>
                      <th className={celda}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {franjas.map((x, i) => {
                      const f = r.franjas[i]
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)' }}>
                          <td className={celda}>{inp(x.descripcion, (v) => cambiaFranja(i, 'descripcion', v), { placeholder: 'ZC eje Y-00 y CT-2 eje Y-01', style: { padding: '6px 8px', fontSize: 13, minWidth: 180 } })}</td>
                          <td className={celda}>{numero(x.largo, (v) => cambiaFranja(i, 'largo', v))}</td>
                          <td className={celda}>{numero(x.separacion, (v) => cambiaFranja(i, 'separacion', v))}</td>
                          <td className={celda}>{numero(x.profundidad, (v) => cambiaFranja(i, 'profundidad', v))}</td>
                          <td className={`${celda} num text-xs`} style={{ color: f.entra ? '#f0b866' : 'var(--cc-suave)' }}>{f.formula}</td>
                          <td className={celda}>
                            {puedeEscribir && (
                              <BotonIcono peligro title="Quitar franja" onClick={() => setFranjas((xs) => xs.filter((_, j) => j !== i))}>
                                ×
                              </BotonIcono>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-cc-suave">Sin franjas. Agrega una cuando dos cepas queden muy juntas.</p>
            )}
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
                      <th className="py-1 text-right">m³</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.porElemento).map(([k, v]) => (
                      <tr key={k} style={{ borderTop: '1px solid var(--cc-borde)' }}>
                        <td className="py-1">{k}</td>
                        <td className="py-1 text-right">{fmt(v.ml)}</td>
                        <td className="py-1 text-right">{fmt(v.volumen)}</td>
                      </tr>
                    ))}
                    {r.volFranjas > 0 && (
                      <tr style={{ borderTop: '1px solid var(--cc-borde)', color: '#f0b866' }}>
                        <td className="py-1">Franjas menores a {fmt(entrada.criterios.separacionMinima)} m</td>
                        <td></td>
                        <td className="py-1 text-right">{fmt(r.volFranjas)}</td>
                      </tr>
                    )}
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
              {r.rellenoFranjas > 0 && (
                <p className="text-xs text-cc-suave">
                  Las franjas suman también <b className="num">{fmt(r.rellenoFranjas)} m³</b> al relleno (se anotan en el análisis para usarlas en el concepto de relleno).
                </p>
              )}
              {ref > 0 && hayValidos && (
                <div style={{ ...avisoStyle(cuadra ? 'verde' : 'ambar'), padding: '10px 14px' }}>
                  <b style={{ color: cuadra ? '#34d399' : '#f0b866' }}>{cuadra ? '✓ Cuadra con Neodata' : '≠ No cuadra con Neodata'}</b>
                  <span className="num ml-2 text-cc-suave">
                    generador {fmt(r.total)} · Neodata {fmt(ref)}
                    {!cuadra && ` · Δ ${fmt(r.total - ref)} ${unidadTexto(concepto.unidad)}`}
                  </span>
                  {!cuadra && r.total < ref && <p className="mt-1 text-xs text-cc-suave">Faltan elementos por capturar, o Neodata incluye algo más (contratrabes, trabes de liga, franjas…).</p>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              <Boton variante="pri" disabled={!puedeEscribir || !hayValidos || ocupado} onClick={guardar}>
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
