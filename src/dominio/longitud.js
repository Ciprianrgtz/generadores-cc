import { tramosDeExcavacion } from './plantilla.js'
import { dato, fmt, r2 } from './redondeo.js'

/**
 * Longitud de elementos (ml): cimbra de zapatas corridas, de trabes de liga, dalas…
 * Todo concepto que se paga por metro lineal de un elemento del plano.
 *
 *   Cantidad = Σ ml del elemento × piezas
 *
 *   · Los tramos salen del análisis de excavación guardado (los ml del elemento del plano:
 *     en una esquina el tramo cuenta completo en los dos lados).
 *   · Qué elementos entran depende del concepto: la cimbra de zapatas corridas lleva solo ZC,
 *     la de trabes de liga solo TL. Se marca con la casilla de cada tramo.
 *   · Un elemento que no esté en la excavación (una contratrabe dentro de la cepa, una dala)
 *     se agrega a mano con su ml.
 */

/**
 * Criterio solo de dibujo (no cambia la cantidad): el alto de la frontera de cimbra sobre el
 * desplante del elemento. Zapata de 20 cm de peralte; se edita según el elemento.
 */
export const CRITERIOS_LONGITUD = { alto: 0.2 }

/** Qué elementos entran solos, según de qué es el concepto (siempre se puede cambiar con las casillas). */
export function elementosDelConcepto(descripcion) {
  const d = String(descripcion ?? '')
  if (/zapatas?\s+corrida/i.test(d)) return /^ZC/i
  if (/trabes?\s+de\s+liga|\bTL-?\d/i.test(d)) return /^TL/i
  return null
}

/** Tramos tomados de un análisis de excavación guardado; entran los que pide el patrón. */
export function tramosPorLongitud(datosExcavacion, patron) {
  return tramosDeExcavacion(datosExcavacion).map((t) => ({
    elemento: t.elemento,
    eje: t.eje,
    entre: t.entre,
    ml: t.ml,
    piezas: t.piezas,
    // para dibujarlo por ejes en el 3D
    ancho: t.ancho,
    desfase: t.desfase,
    inicio: t.inicio,
    desplante: t.desplante,
    incluir: patron ? patron.test(String(t.elemento ?? '').trim()) : false,
  }))
}

export function calcularTramo(t) {
  const piezas = t.piezas > 0 ? t.piezas : 1
  const total = t.ml * piezas
  const valido = t.ml > 0
  const formula = `${dato(t.ml)}${piezas !== 1 ? ` × ${dato(piezas)}` : ''} = ${fmt(total)} ml`
  return { ...t, piezas, total, valido, formula }
}

export function analizarLongitud({ tramos = [] }) {
  const filas = tramos.map(calcularTramo)
  const usadas = filas.filter((f) => f.valido && f.incluir !== false)
  const total = usadas.reduce((s, f) => s + f.total, 0)
  return {
    filas,
    total,
    cantidad: r2(total),
    formula: `Σ ml = ${usadas.map((f) => fmt(f.total)).join(' + ') || '0'} = ${fmt(total)} ml`,
  }
}
