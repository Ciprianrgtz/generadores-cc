import { useEffect, useMemo, useState } from 'react'
import { agruparCopias, analizarBastones, clasesDeRectangulos, CRITERIOS_BASTONES, girarZona, grupoDelConcepto, leerRectangulosDxf, origenSugerido, zonasDeCopia } from '../dominio/bastones'
import { plantasDeEjesDxf } from '../dominio/ejes'
import { fmt, unidadTexto } from '../dominio/redondeo'
import { UNIDADES_DXF } from '../dominio/terreno'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle, botones } from '../lib/ui'
import { useVarillas, varillasPorId } from '../lib/useVarillas'
import ComoSeGenera from './ComoSeGenera'
import { Aviso, Boton, BotonIcono, Campo, Chip, Entrada, Seccion, Seleccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')
const aTexto = (z) => ({ ...z, largo: texto(Number(z.largo)), ml: texto(Number(z.ml)) })
// copias de la planta que forman los rectángulos que se marcaron como zonas (CC o CI)
const copiasDe = (rects, clases) => {
  const zonas = new Set(clases.filter((c) => c.grupo).map((c) => c.clave))
  return agruparCopias(rects.filter((r) => zonas.has(`${r.capa}|${r.color ?? ''}`)))
}
const formDesdeCriterios = (c) => ({
  varilla: c.varilla,
  separacion: texto(c.separacion),
  sumarUna: c.sumarUna !== false,
  redondearArriba: c.redondearArriba !== false,
  piezas: c.piezasPorMetro > 0 ? texto(c.piezasPorMetro) : '',
  gancho: texto(c.gancho ?? 0),
  escuadras: texto(c.escuadras ?? 1),
  desperdicio: texto(Math.round((c.desperdicio ?? 0.03) * 1000) / 10),
})

/**
 * Bastones de la losa de cimentación (CC colindante, CI intermedia): cada zona es una franja de la losa
 * con su largo de bastón (claro ÷ 4, redondeado a una medida práctica) y sus ml. Las zonas se importan
 * de los rectángulos dibujados en el DXF o se capturan a mano; se ven en el 3D mientras se capturan.
 */
export default function GeneradorBastones({ concepto, puedeEscribir, onGuardado, onVolver, onCapturar }) {
  const varillas = useVarillas()
  const tabla = useMemo(() => varillasPorId(varillas.datos), [varillas.datos])
  const grupoConcepto = grupoDelConcepto(concepto.descripcion) // CC, CI o null (entran todas)
  const [zonas, setZonas] = useState([])
  const [criterios, setCriterios] = useState(formDesdeCriterios(CRITERIOS_BASTONES))
  const [referencia, setReferencia] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [importar, setImportar] = useState(null) // lectura del DXF en curso
  const [unidad, setUnidad] = useState('m')
  const [leyendo, setLeyendo] = useState(false)

  useEffect(() => {
    let vivo = true
    repo
      .generador(concepto.id)
      .then((g) => {
        if (!vivo) return
        setGuardado(g)
        const d = g?.datos
        if (d?.zonas) {
          setZonas(d.zonas.map(aTexto))
          setCriterios(formDesdeCriterios({ ...CRITERIOS_BASTONES, ...d.criterios }))
          setReferencia(d.referencia != null ? texto(d.referencia) : '')
        }
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id])

  const criteriosNum = useMemo(
    () => ({
      varilla: criterios.varilla,
      separacion: num(criterios.separacion),
      sumarUna: criterios.sumarUna,
      redondearArriba: criterios.redondearArriba,
      piezasPorMetro: num(criterios.piezas) > 0 ? num(criterios.piezas) : null,
      gancho: num(criterios.gancho) > 0 ? num(criterios.gancho) : 0,
      escuadras: num(criterios.escuadras) >= 0 ? num(criterios.escuadras) : 1,
      desperdicio: Number.isFinite(num(criterios.desperdicio)) ? num(criterios.desperdicio) / 100 : 0.03,
    }),
    [criterios],
  )
  const kgM = tabla[criterios.varilla]?.kg_m ?? null
  const entrada = useMemo(() => zonas.map((z) => ({ ...z, largo: num(z.largo), ml: num(z.ml) })), [zonas])
  const r = useMemo(() => analizarBastones({ zonas: entrada, criterios: criteriosNum, kgM }), [entrada, criteriosNum, kgM])
  const ref = num(referencia)
  const cuadra = ref > 0 && Math.abs(r.cantidad - ref) < 0.005
  const ajenas = zonas.filter((z) => grupoConcepto && z.grupo !== grupoConcepto).length

  const datosZonas = () =>
    entrada.map((z) => ({ tipo: z.tipo ?? '', grupo: z.grupo ?? '', largo: z.largo, ml: z.ml, incluir: z.incluir !== false, manual: !!z.manual, rect: z.rect ?? null }))

  // las zonas con sus bastones se dibujan en el 3D mientras se capturan (principio 11)
  useEffect(() => {
    if (!(kgM > 0)) return
    onCapturar?.('bastones', { zonas: datosZonas(), criterios: criteriosNum, kgM })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, criteriosNum, kgM, onCapturar])

  const cambia = (i, k, v) => setZonas(zonas.map((z, j) => (j === i ? { ...z, [k]: v } : z)))
  const girar = (i) => setZonas(zonas.map((z, j) => (j === i ? aTexto(girarZona({ ...z, largo: num(z.largo), ml: num(z.ml) })) : z)))
  const quitar = (i) => setZonas(zonas.filter((_, j) => j !== i))
  const agregar = () =>
    setZonas([...zonas, { tipo: grupoConcepto ? `${grupoConcepto}-1` : '', grupo: grupoConcepto ?? 'CC', largo: '', ml: '', incluir: true, manual: true }])

  async function leerDxf(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setMensaje(null)
    setLeyendo(true)
    try {
      const contenido = await archivo.text()
      await new Promise((ok) => setTimeout(ok, 30)) // deja pintar «Leyendo…» antes del trabajo pesado
      const factor = UNIDADES_DXF[unidad]
      const rects = leerRectangulosDxf(contenido, factor)
      if (!rects.length) throw new Error('El DXF no tiene rectángulos cerrados que puedan ser zonas.')
      let plantas = []
      try {
        plantas = plantasDeEjesDxf(contenido, factor)
      } catch {
        plantas = []
      }
      const clases = clasesDeRectangulos(rects)
      const copias = copiasDe(rects, clases)
      setImportar({ archivo: archivo.name, rects, copias, clases, plantas, copia: 0, origen: copias[0] ? origenSugerido(copias[0], plantas) : { x: 0, y: 0 } })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setLeyendo(false)
    }
  }
  const elegirCopia = (i) => setImportar((s) => ({ ...s, copia: i, origen: origenSugerido(s.copias[i], s.plantas) }))
  const cambiaClase = (clave, grupo) =>
    setImportar((s) => {
      const clases = s.clases.map((c) => (c.clave === clave ? { ...c, grupo } : c))
      const copias = copiasDe(s.rects, clases)
      return { ...s, clases, copias, copia: 0, origen: copias[0] ? origenSugerido(copias[0], s.plantas) : s.origen }
    })
  const traer = () => {
    const nuevas = zonasDeCopia(importar.copias[importar.copia], importar.clases, importar.origen).filter((z) => !grupoConcepto || z.grupo === grupoConcepto)
    setZonas(nuevas.map(aTexto))
    setImportar(null)
    setMensaje({ tipo: 'ok', texto: `${nuevas.length} zonas importadas. Revisa las marcadas «revisar lado»: si el lado corto no es el bastón, usa ⟲.` })
  }

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const datos = {
        grupo: grupoConcepto,
        criterios: criteriosNum,
        kgM,
        zonas: datosZonas(),
        porTipo: r.porTipo,
        porDiametro: r.porDiametro,
        referencia: ref > 0 ? ref : null,
      }
      const g = await repo.guardarGenerador(concepto.id, {
        tipo: 'bastones',
        datos,
        cantidad: Math.round(r.total * 10000) / 10000,
        unidad: concepto.unidad,
        formula: `${r.formulaPiezas} · ${r.formula}`,
      })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis de bastones guardado.' })
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
  const cr = (k, v) => setCriterios({ ...criterios, [k]: v })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · bastones de losa de cimentación</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0].split('.')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}
      {varillas.datos.length > 0 && !(kgM > 0) && <Aviso>La varilla #{criterios.varilla} no tiene peso en la tabla de varillas: sin kg/m no hay cantidad.</Aviso>}
      {ajenas > 0 && (
        <Aviso>
          {ajenas} zona(s) son de {grupoConcepto === 'CC' ? 'CI' : 'CC'} y no entran en este concepto.
        </Aviso>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Tarjeta className="grid content-start gap-3 p-5">
            <Seccion>Criterios</Seccion>
            <Campo etiqueta="Varilla del bastón">
              <Seleccion value={criterios.varilla} disabled={!puedeEscribir} onChange={(e) => cr('varilla', e.target.value)}>
                {varillas.datos.map((v) => (
                  <option key={v.id} value={v.id}>#{v.id} · {Number(v.kg_m).toFixed(3)} kg/m</option>
                ))}
                {!varillas.datos.length && <option value={criterios.varilla}>#{criterios.varilla}</option>}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Separación (m)">
              <Entrada value={criterios.separacion} disabled={!puedeEscribir} onChange={(e) => cr('separacion', e.target.value)} type="number" step="0.01" min="0" className="num" />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={criterios.sumarUna} disabled={!puedeEscribir} onChange={(e) => cr('sumarUna', e.target.checked)} />
              Sumar una varilla (distancia ÷ separación + 1)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={criterios.redondearArriba} disabled={!puedeEscribir} onChange={(e) => cr('redondearArriba', e.target.checked)} />
              Redondear hacia arriba (7.67 → 8)
            </label>
            <Campo etiqueta="Varillas por metro (si se captura, manda sobre la separación)">
              <Entrada value={criterios.piezas} disabled={!puedeEscribir} onChange={(e) => cr('piezas', e.target.value)} type="number" step="0.01" min="0" className="num" placeholder={`se calcula: ${fmt(r.piezasPorMetro)}`} />
            </Campo>
            <Campo etiqueta="Largo de cada escuadra a 90° (m)">
              <Entrada value={criterios.gancho} disabled={!puedeEscribir} onChange={(e) => cr('gancho', e.target.value)} type="number" step="0.01" min="0" className="num" />
            </Campo>
            <Campo etiqueta="Escuadras por bastón (0 = bastón recto)">
              <Entrada value={criterios.escuadras} disabled={!puedeEscribir} onChange={(e) => cr('escuadras', e.target.value)} type="number" step="1" min="0" className="num" />
            </Campo>
            <Campo etiqueta="Desperdicio (%)">
              <Entrada value={criterios.desperdicio} disabled={!puedeEscribir} onChange={(e) => cr('desperdicio', e.target.value)} type="number" step="0.5" min="0" className="num" />
            </Campo>
            <p className="text-xs text-cc-tenue">Criterios de la oficina: 8 varillas por metro y una escuadra de 5 cm por bastón. Neodata usa 7 varillas por metro (capturadas a mano) y sin escuadra.</p>
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
              <Seccion>Zonas de bastón{grupoConcepto ? ` · ${grupoConcepto}` : ''}</Seccion>
              {puedeEscribir && (
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center" style={{ ...botones.sec, padding: '4px 10px', fontSize: 12 }}>
                    {leyendo ? 'Leyendo el DXF…' : 'Importar del DXF'}
                    <input type="file" accept=".dxf" className="hidden" onChange={leerDxf} disabled={leyendo} />
                  </label>
                  <select value={unidad} onChange={(e) => setUnidad(e.target.value)} title="Unidades del dibujo">
                    {Object.keys(UNIDADES_DXF).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <Boton chico onClick={agregar}>+ Zona a mano</Boton>
                </span>
              )}
            </div>

            {importar && (
              <div className="grid gap-3 px-4 py-3 text-sm" style={{ borderBottom: '1px solid var(--cc-borde)', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs text-cc-suave">
                  {importar.archivo} · {importar.copias.length} copia(s) de zonas. Cada zona es un rectángulo cerrado: el lado corto es el largo del bastón y el largo, los ml de la franja.
                </p>
                <div className="grid gap-1">
                  <span className="text-xs font-bold text-cc-suave">¿Qué es cada capa y color?</span>
                  {importar.clases.map((c) => (
                    <label key={c.clave} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="num w-44">capa {c.capa} · color {c.color ?? '—'}</span>
                      <span className="num w-20 text-cc-suave">{c.n} rect.</span>
                      <select value={c.grupo} onChange={(e) => cambiaClase(c.clave, e.target.value)}>
                        <option value="">no son zonas</option>
                        <option value="CC">CC (colindante)</option>
                        <option value="CI">CI (intermedia)</option>
                      </select>
                    </label>
                  ))}
                </div>
                {!importar.copias.length && <p className="text-xs" style={{ color: '#f0b866' }}>Marca qué capa y color son CC o CI para ver las copias de la planta.</p>}
                {importar.copias.length > 1 && (
                  <div className="grid gap-1">
                    <span className="text-xs font-bold text-cc-suave">Copia del dibujo que se importa</span>
                    {importar.copias.map((c, i) => (
                      <label key={i} className="num flex items-center gap-2 text-xs">
                        <input type="radio" checked={importar.copia === i} onChange={() => elegirCopia(i)} />
                        {c.rects.length} rect. · x {fmt(c.x0)} a {fmt(c.x1)} · y {fmt(c.y0)} a {fmt(c.y1)}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-cc-suave">Dónde está el 0,0 del proyecto (Y-00 / X-00) en esa copia:</span>
                  <span>x</span>
                  <Entrada value={importar.origen.x} onChange={(e) => setImportar({ ...importar, origen: { ...importar.origen, x: num(e.target.value) } })} type="number" step="0.001" className="num" style={{ padding: '4px 8px', fontSize: 13, width: 100 }} />
                  <span>y</span>
                  <Entrada value={importar.origen.y} onChange={(e) => setImportar({ ...importar, origen: { ...importar.origen, y: num(e.target.value) } })} type="number" step="0.001" className="num" style={{ padding: '4px 8px', fontSize: 13, width: 100 }} />
                  <span className="text-cc-tenue">Se sugiere; si el dibujo no queda sobre la planta en el 3D, corrígelo.</span>
                </div>
                <div className="flex gap-2">
                  <Boton chico variante="pri" disabled={!importar.copias.length} onClick={traer}>
                    Traer las zonas{grupoConcepto ? ` de ${grupoConcepto}` : ''}
                  </Boton>
                  <Boton chico onClick={() => setImportar(null)}>Cancelar</Boton>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    <th className={celda}>Entra</th>
                    <th className={celda}>Tipo</th>
                    <th className={celda}>Largo del bastón (m)</th>
                    <th className={celda}>ml de la franja</th>
                    <th className={celda}>Cálculo</th>
                    <th className={celda}></th>
                  </tr>
                </thead>
                <tbody>
                  {zonas.map((z, i) => {
                    const f = r.filas[i]
                    const entra = z.incluir !== false
                    const ajena = grupoConcepto && z.grupo !== grupoConcepto
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)', opacity: entra && !ajena ? 1 : 0.45 }}>
                        <td className={celda}>
                          <input type="checkbox" checked={entra} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'incluir', e.target.checked)} />
                        </td>
                        <td className={celda}>
                          <Entrada value={z.tipo ?? ''} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'tipo', e.target.value)} className="num" style={{ padding: '6px 8px', fontSize: 13, width: 84 }} />
                        </td>
                        <td className={celda}>
                          <span className="flex items-center gap-1">
                            {numero(z.largo, (v) => cambia(i, 'largo', v))}
                            {z.dudosa && <Chip color="ambar">revisar lado</Chip>}
                          </span>
                        </td>
                        <td className={celda}>{numero(z.ml, (v) => cambia(i, 'ml', v))}</td>
                        <td className={`${celda} num text-xs`}>{f?.valido ? f.formula : '—'}</td>
                        <td className={`${celda} whitespace-nowrap`}>
                          {puedeEscribir && (
                            <>
                              <BotonIcono title="Girar: el largo del bastón y los ml se intercambian" onClick={() => girar(i)}>⟲</BotonIcono>
                              <BotonIcono peligro title="Quitar zona" onClick={() => quitar(i)}>✕</BotonIcono>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!zonas.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm text-cc-suave">
                        Sin zonas. Importa los rectángulos del DXF o agrega zonas a mano con su largo de bastón (claro ÷ 4) y sus ml.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-xs text-cc-tenue" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              Los bastones miden el claro ÷ 4, redondeado a una medida práctica (1.1 o 1.05 en lugar de 1.0387), porque en obra no se cortan al milímetro. En CI (intermedia) el bastón cubre los dos claros: su largo es el de todo el rectángulo. En una zona casi cuadrada hay que revisar cuál lado es el bastón.
            </p>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cálculo</Seccion>
            </div>
            <div className="grid gap-3 px-4 py-4 text-sm">
              <span className="num text-xs text-cc-suave">{r.formulaPiezas}</span>
              {r.porTipo.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                        <th className="py-1 pr-2">Tipo</th>
                        <th className="py-1 pr-2">Bastón (m)</th>
                        <th className="py-1 pr-2">Zonas</th>
                        <th className="py-1 pr-2">ml</th>
                        <th className="py-1 pr-2">kg/ml</th>
                        <th className="py-1 pr-2">kg</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {r.porTipo.map((t) => (
                        <tr key={t.tipo} style={{ borderTop: '1px solid var(--cc-borde)' }}>
                          <td className="py-1 pr-2 font-bold">{t.tipo}</td>
                          <td className="py-1 pr-2">{t.largo}</td>
                          <td className="py-1 pr-2">{t.zonas}</td>
                          <td className="py-1 pr-2">{fmt(t.ml)}</td>
                          <td className="py-1 pr-2">{fmt(t.kgMl, 3)}</td>
                          <td className="py-1 pr-2">{fmt(t.kg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <span className="num text-xs text-cc-suave">{r.formula}</span>
              {Object.keys(r.porDiametro).length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-cc-suave">
                  <span>Por diámetro:</span>
                  {Object.entries(r.porDiametro).map(([n, kg]) => (
                    <span key={n} className="num">#{n} · {fmt(kg)} kg</span>
                  ))}
                </div>
              )}
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
