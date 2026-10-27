import { useEffect, useMemo, useState } from 'react'
import { analizarAcero, claveDeElemento, elementoDelConcepto, resumenDeFicha, tramosDeElemento } from '../dominio/acero'
import { fmt, unidadTexto } from '../dominio/redondeo'
import * as fichas from '../lib/fichasRepo'
import * as repo from '../lib/proyectosRepo'
import { avisoStyle } from '../lib/ui'
import ComoSeGenera from './ComoSeGenera'
import { Aviso, Boton, BotonIcono, Campo, Chip, Entrada, Seccion, Seleccion, Tarjeta } from './ui'

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const texto = (n) => (Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : '')
const aTexto = (t) => ({ ...t, ml: texto(t.ml), piezas: texto(t.piezas) })
const ESTADO = { borrador: { nombre: 'Borrador', color: 'ambar' }, revisado: { nombre: 'Revisada', color: 'azul' }, aprobado: { nombre: 'Aprobada', color: 'verde' } }

/**
 * Generador de acero por ficha: kg = ml del elemento × kg/ml de su ficha. Los ml salen de los tramos
 * de la excavación (o se agregan a mano); los kg/ml, de la última versión de la ficha del elemento.
 * Un tipo nuevo de zapata (otra separación, otros números de varilla) solo necesita su ficha.
 */
export default function GeneradorAcero({ concepto, generadores, proyecto, puedeEscribir, onGuardado, onVolver, onCapturar, onAbrirFicha }) {
  const excavaciones = generadores.filter((g) => g.tipo === 'excavacion' && g.datos?.renglones?.length)
  const [elementos, setElementos] = useState(null) // elementos tipo del proyecto, cada uno con su última ficha
  const [codigo, setCodigo] = useState(null) // elemento elegido (código del elemento tipo)
  const [tramos, setTramos] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const origen = excavaciones[0]

  useEffect(() => {
    let vivo = true
    Promise.all([repo.generador(concepto.id), fichas.fichasDelProyecto(proyecto.id)])
      .then(([g, lista]) => {
        if (!vivo) return
        setGuardado(g)
        setElementos(lista)
        const d = g?.datos
        if (d?.tramos) {
          setTramos(d.tramos.map(aTexto))
          setReferencia(d.referencia != null ? texto(d.referencia) : '')
        }
        const quiere = d?.elemento ?? elementoDelConcepto(concepto.descripcion)
        const hallado = lista.find((e) => claveDeElemento(e.codigo) === claveDeElemento(quiere))
        setCodigo(hallado?.codigo ?? quiere ?? lista[0]?.codigo ?? null)
      })
      .catch((e) => vivo && setMensaje({ tipo: 'error', texto: repo.mensajeError(e) }))
    return () => {
      vivo = false
    }
  }, [concepto.id, concepto.descripcion, proyecto.id])

  const elemento = elementos?.find((e) => e.codigo === codigo) ?? null
  const ficha = useMemo(() => resumenDeFicha(elemento?.ficha ? { ...elemento.ficha } : null), [elemento])
  const peralte = elemento?.ficha?.parametros?.seccion?.peralte ?? elemento?.seccion?.peralte ?? null

  const datosOrigen = origen?.datos
  const lista = useMemo(() => {
    if (!tramos) return datosOrigen && codigo ? tramosDeElemento(datosOrigen, codigo).map(aTexto) : []
    // análisis guardados sin los datos para dibujar: se toman de la excavación
    if (!datosOrigen || tramos.every((t) => t.manual || t.ancho != null)) return tramos
    const frescos = new Map(tramosDeElemento(datosOrigen, codigo).map((t) => [`${t.eje}|${t.entre}|${t.ml}`, t]))
    return tramos.map((t) => {
      const f = t.manual || t.ancho != null ? null : frescos.get(`${t.eje}|${t.entre}|${num(t.ml)}`)
      return f ? { ...t, ancho: f.ancho, desfase: f.desfase, inicio: f.inicio, desplante: f.desplante } : t
    })
  }, [tramos, datosOrigen, codigo])
  const entrada = useMemo(() => lista.map((t) => ({ ...t, ml: num(t.ml), piezas: num(t.piezas) || 1 })), [lista])
  const r = useMemo(() => analizarAcero({ tramos: entrada, ficha }), [entrada, ficha])
  const ref = num(referencia)
  const cuadra = ref > 0 && Math.abs(r.cantidad - ref) < 0.005

  // la ficha pudo cambiar después de guardar: se avisa, y se usa siempre la vigente
  const previa = guardado?.datos?.ficha
  const fichaCambio = previa && ficha && (previa.id !== ficha.id || Math.abs(previa.kgMl - ficha.kgMl) > 1e-9)
  const excavacionCambio =
    guardado?.datos?.origen?.actualizado_en && origen?.actualizado_en && new Date(origen.actualizado_en) > new Date(guardado.datos.origen.actualizado_en)

  const datosTramos = () =>
    entrada.map((t) => ({ elemento: t.elemento, eje: t.eje ?? '', entre: t.entre ?? '', ml: t.ml, piezas: t.piezas, incluir: t.incluir !== false, manual: !!t.manual, ancho: t.ancho ?? null, desfase: t.desfase ?? null, inicio: t.inicio ?? null, desplante: t.desplante ?? null }))

  // el elemento con su acero se dibuja en el 3D mientras se captura (principio 11)
  useEffect(() => {
    if (!ficha) return
    onCapturar?.('acero_ficha', { tramos: datosTramos(), ficha: { kgMl: ficha.kgMl, peralte } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada, ficha, peralte, onCapturar])

  const cambia = (i, k, v) => setTramos(lista.map((t, j) => (j === i ? { ...t, [k]: v } : t)))
  const retomar = () => {
    if (origen && codigo) setTramos(tramosDeElemento(origen.datos, codigo).map(aTexto))
  }
  const elegirElemento = (c) => {
    setCodigo(c)
    setTramos(null) // los tramos se vuelven a tomar de la excavación para ese elemento
  }
  const agregar = () => setTramos([...lista, { elemento: codigo ?? '', eje: '', entre: '', ml: '', piezas: '1', incluir: true, manual: true }])
  const quitar = (i) => setTramos(lista.filter((_, j) => j !== i))

  async function guardar() {
    setOcupado(true)
    setMensaje(null)
    try {
      const datos = {
        origen: origen ? { paquete_concepto_id: origen.paquete_concepto_id, concepto: origen.concepto?.clave ?? null, actualizado_en: origen.actualizado_en ?? null } : null,
        elemento: codigo,
        ficha: { id: ficha.id, elemento_tipo_id: elemento.id, version: ficha.version, estado: ficha.estado, kgMl: ficha.kgMl, porDiametro: ficha.porDiametro, peralte },
        tramos: datosTramos(),
        porDiametro: r.porDiametro,
        referencia: ref > 0 ? ref : null,
      }
      const g = await repo.guardarGenerador(concepto.id, {
        tipo: 'acero_ficha',
        datos,
        cantidad: Math.round(r.total * 10000) / 10000,
        unidad: concepto.unidad,
        formula: `${r.formulaMl} · ${r.formula}`,
      })
      setGuardado(g)
      setMensaje({ tipo: 'ok', texto: 'Análisis de acero guardado.' })
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
  const textoLibre = (valor, onChange, w) => (
    <Entrada value={valor} disabled={!puedeEscribir} onChange={(e) => onChange(e.target.value)} style={{ padding: '6px 8px', fontSize: 13, width: w }} />
  )
  const diametros = Object.entries(r.porDiametro)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Conceptos</Boton>
        <div className="min-w-0">
          <Seccion>Análisis · acero por ficha</Seccion>
          <h3 className="text-lg font-bold">
            <span className="num text-cc-suave">{concepto.clave}</span> · {concepto.descripcion.split(',')[0].split('.')[0]}
          </h3>
        </div>
        <span className="num ml-auto text-sm text-cc-suave">Unidad del concepto: {concepto.unidad}</span>
      </div>

      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}
      {elementos && !elemento && (
        <Aviso>
          No encuentro el elemento de este concepto entre los tipos del proyecto. Elígelo en la lista o créalo en la ficha de zapata corrida.
        </Aviso>
      )}
      {elemento && !ficha && (
        <Aviso>
          {elemento.codigo} todavía no tiene ficha guardada: sin sus kg/ml no hay cantidad.{' '}
          {onAbrirFicha && <Boton chico onClick={() => onAbrirFicha(proyecto.clave)}>Abrir la ficha</Boton>}
        </Aviso>
      )}
      {ficha && ficha.estado !== 'aprobado' && (
        <Aviso>
          La ficha de {elemento.codigo} (v{ficha.version}) está en <b>{ESTADO[ficha.estado].nombre.toLowerCase()}</b>: la cantidad queda provisional hasta que otra persona la apruebe.
        </Aviso>
      )}
      {fichaCambio && (
        <Aviso>
          La ficha cambió desde que guardaste: antes v{previa.version} con {fmt(previa.kgMl, 6)} kg/ml, ahora v{ficha.version} con {fmt(ficha.kgMl, 6)} kg/ml. Se calcula con la vigente; guarda para actualizarlo.
        </Aviso>
      )}
      {excavacionCambio && (
        <Aviso>
          La excavación cambió después de guardar este análisis.{' '}
          {puedeEscribir && <Boton chico onClick={retomar}>Volver a tomar los tramos</Boton>}
        </Aviso>
      )}
      {!excavaciones.length && !tramos && (
        <Aviso>Primero hay que guardar el análisis de excavación (de ahí salen los ml del elemento). También puedes agregar tramos a mano.</Aviso>
      )}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Tarjeta className="grid content-start gap-3 p-5">
            <Seccion>Elemento y su ficha</Seccion>
            <Seleccion value={codigo ?? ''} disabled={!puedeEscribir || !elementos?.length} onChange={(e) => elegirElemento(e.target.value)}>
              {(elementos ?? []).map((e) => (
                <option key={e.id} value={e.codigo}>{e.codigo}{e.ficha ? '' : ' · sin ficha'}</option>
              ))}
            </Seleccion>
            {ficha ? (
              <>
                <p className="num text-sm">
                  {fmt(ficha.kgMl, 6)} kg/ml <Chip color={ESTADO[ficha.estado].color}>v{ficha.version} · {ESTADO[ficha.estado].nombre}</Chip>
                </p>
                <p className="text-xs text-cc-tenue">
                  La separación, los números de varilla (uno por sentido), el recubrimiento, los ganchos y el desperdicio viven en la ficha. Un tipo de zapata con otro armado solo necesita su propia ficha.
                </p>
              </>
            ) : null}
            {onAbrirFicha && <Boton chico onClick={() => onAbrirFicha(proyecto.clave)}>Abrir la ficha / crear un tipo nuevo</Boton>}
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
              <Seccion>Tramos del elemento</Seccion>
              {puedeEscribir && (
                <Boton chico className="ml-auto" onClick={agregar}>+ Tramo a mano</Boton>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
                    <th className={celda}>Entra</th>
                    <th className={celda}>Elemento</th>
                    <th className={celda}>Ubicación</th>
                    <th className={celda}>ml del elemento</th>
                    <th className={celda}>Piezas</th>
                    <th className={celda}>Cálculo</th>
                    <th className={celda}></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((t, i) => {
                    const f = r.filas[i]
                    const entra = t.incluir !== false
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--cc-borde)', opacity: entra ? 1 : 0.45 }}>
                        <td className={celda}>
                          <input type="checkbox" checked={entra} disabled={!puedeEscribir} onChange={(e) => cambia(i, 'incluir', e.target.checked)} />
                        </td>
                        <td className={`${celda} num font-bold`}>{t.manual ? textoLibre(t.elemento, (v) => cambia(i, 'elemento', v), 86) : t.elemento}</td>
                        <td className={`${celda} num text-xs text-cc-suave`}>
                          {t.manual ? textoLibre(t.eje, (v) => cambia(i, 'eje', v), 120) : [t.eje, t.entre].filter(Boolean).join(' · ')}
                        </td>
                        <td className={celda}>{numero(t.ml, (v) => cambia(i, 'ml', v))}</td>
                        <td className={celda}>{numero(t.piezas, (v) => cambia(i, 'piezas', v), 60)}</td>
                        <td className={`${celda} num text-xs`}>{f.valido ? f.formula : '—'}</td>
                        <td className={celda}>
                          {t.manual && puedeEscribir && <BotonIcono peligro title="Quitar tramo" onClick={() => quitar(i)}>✕</BotonIcono>}
                        </td>
                      </tr>
                    )
                  })}
                  {!lista.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-sm text-cc-suave">{codigo ? `Sin tramos de ${codigo} en la excavación.` : 'Sin tramos.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-2 text-xs text-cc-tenue" style={{ borderTop: '1px solid var(--cc-borde)' }}>
              Los tramos son los de {codigo ?? 'este elemento'} en la excavación, con los ml del elemento del plano (en una esquina cuenta completo en los dos lados).
            </p>
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
              <Seccion>Cálculo</Seccion>
            </div>
            <div className="grid gap-3 px-4 py-4 text-sm">
              <span className="num text-xs text-cc-suave">{r.formulaMl}</span>
              <span className="num text-xs text-cc-suave">{r.formula}</span>
              {diametros.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-cc-suave">
                  <span>Por diámetro:</span>
                  {diametros.map(([n, kg]) => (
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
              <Boton variante="pri" disabled={!puedeEscribir || !(r.total > 0) || !ficha || ocupado} onClick={guardar}>
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
