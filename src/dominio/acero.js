import { analizarLongitud, tramosPorLongitud } from './longitud.js'
import { fmt, r2 } from './redondeo.js'

/**
 * Acero por ficha (kg): el acero de un elemento tipo (ZC-01, ZC-02, un tipo nuevo…) se paga por kg.
 *
 *   Cantidad = Σ ml del elemento × kg/ml de su ficha
 *
 *   · Los ml salen de los tramos de la excavación guardada que son de ese elemento (los ml del
 *     elemento del plano), o se agregan a mano.
 *   · Los kg/ml salen de la última versión de la ficha del elemento: ahí viven la separación, los
 *     números de varilla (uno por sentido), el recubrimiento, los ganchos y el desperdicio. Un tipo
 *     nuevo de zapata solo necesita su propia ficha; este cálculo no cambia.
 *   · Se guarda también el desglose por diámetro (kg de #3, kg de #4…) para la explosión de insumos.
 */

/** «ZC-01», «ZC-1», «zc 1» → «ZC-1». Sirve para emparejar el nombre del plano con el de la ficha. */
export function claveDeElemento(texto) {
  const m = /([A-Z]{1,3})\s*-?\s*0*(\d+)(?!\d)/i.exec(String(texto ?? '').trim())
  return m ? `${m[1].toUpperCase()}-${Number(m[2])}` : null
}

/** El elemento tipo que menciona la descripción de un concepto («…ZAPATA CORRIDA ZC-01 DE 80x20…» → ZC-1). */
export function elementoDelConcepto(descripcion) {
  const m = /\b(ZC|ZA|CT|TL|CC|CI|DD|DC|K|Z|T)\s*-?\s*0*(\d+)(?!\d)/i.exec(String(descripcion ?? ''))
  return m ? `${m[1].toUpperCase()}-${Number(m[2])}` : null
}

/** Tramos de la excavación guardada que son de ese elemento (los demás quedan sin marcar). */
export function tramosDeElemento(datosExcavacion, elemento) {
  const clave = claveDeElemento(elemento)
  const patron = { test: (nombre) => clave != null && claveDeElemento(nombre) === clave }
  return tramosPorLongitud(datosExcavacion, patron)
}

/** Lo que sale de una ficha guardada para usarlo como cantidad (la ficha no se recalcula aquí). */
export function resumenDeFicha(ficha) {
  if (!ficha) return null
  const kgMl = Number(ficha.resultados?.kg_ml)
  if (!(kgMl > 0)) return null
  return {
    id: ficha.id,
    version: ficha.version,
    estado: ficha.estado,
    kgMl,
    porDiametro: ficha.resultados?.acero_kg_ml ?? {},
  }
}

export function analizarAcero({ tramos = [], ficha }) {
  const ml = analizarLongitud({ tramos })
  const kgMl = ficha?.kgMl > 0 ? ficha.kgMl : 0
  const kg = ml.total * kgMl
  // el desglose se reparte con la misma proporción de la ficha: la suma cuadra con el total
  const porDiametro = Object.fromEntries(Object.entries(ficha?.porDiametro ?? {}).map(([n, kgPorMl]) => [n, ml.total * kgPorMl]))
  const cantidad = r2(kg)
  const formula = kgMl > 0 ? `${fmt(ml.total)} ml × ${fmt(kgMl, 6)} kg/ml = ${fmt(kg)} kg` : 'Falta la ficha del elemento'
  return { filas: ml.filas, ml: ml.total, kgMl, total: kg, cantidad, porDiametro, formula, formulaMl: ml.formula }
}
