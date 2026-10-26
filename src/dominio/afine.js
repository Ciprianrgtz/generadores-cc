import { calcularRenglon, CRITERIOS_EXCAVACION } from './excavacion.js'
import { dato, fmt, r2 } from './redondeo.js'

/**
 * Afine y compactación de fondo y taludes de la excavación — método de la oficina
 * (Ciprian, 26-oct-2026).
 *
 * Se afina el fondo y las dos paredes (taludes) de cada cepa:
 *   Área = ml del elemento × (ancho de la cepa + 2 × profundidad de la cepa) × piezas
 *   · Las cepas salen del análisis de excavación: su ancho ya trae el sobreancho y su
 *     profundidad ya trae la plantilla.
 *   · Se cuentan las dos paredes, también la del lindero en colindancia.
 *   · Se usan los ml del elemento del plano (en una esquina cuenta en los dos tramos),
 *     no el largo neto que se usó para no excavar dos veces la esquina.
 *   · Las losas y el firme no entran: su afine es otro concepto (afine para recibir firme).
 */

/** Cepas que se afinan, tomadas de los renglones de un análisis de excavación guardado. */
export function cepasDeExcavacion(datosExcavacion) {
  const c = { ...CRITERIOS_EXCAVACION, ...datosExcavacion?.criterios }
  return (datosExcavacion?.renglones ?? [])
    .map((r) => calcularRenglon(r, c))
    .filter((f) => f.valido)
    .map((f) => ({
      elemento: f.elemento,
      eje: f.eje,
      entre: f.entre,
      ml: Number.isFinite(f.mlElemento) && f.mlElemento > 0 ? f.mlElemento : f.largo,
      ancho: r4(f.anchoCepa),
      profundidad: r4(f.altoCepa),
      piezas: f.piezas,
      incluir: true,
    }))
}
const r4 = (n) => Math.round(n * 10000) / 10000

export function calcularCepa(r) {
  const piezas = r.piezas > 0 ? r.piezas : 1
  const fondo = r.ml * r.ancho * piezas
  const taludes = 2 * r.ml * r.profundidad * piezas
  const area = fondo + taludes
  const valido = r.ml > 0 && r.ancho > 0 && r.profundidad >= 0
  const formula = `${dato(r.ml)} × (${dato(r.ancho)} + 2×${dato(r.profundidad)})${piezas !== 1 ? ` × ${dato(piezas)}` : ''} = ${fmt(area)} m²`
  return { ...r, piezas, fondo, taludes, area, valido, formula }
}

export function analizarAfine({ cepas = [] }) {
  const filas = cepas.map(calcularCepa)
  const usadas = filas.filter((f) => f.valido && f.incluir !== false)
  const fondo = usadas.reduce((s, f) => s + f.fondo, 0)
  const taludes = usadas.reduce((s, f) => s + f.taludes, 0)
  const total = fondo + taludes
  const porElemento = {}
  for (const f of usadas) {
    const x = (porElemento[f.elemento || 'Sin tipo'] ??= { ml: 0, area: 0 })
    x.ml += f.ml * f.piezas
    x.area += f.area
  }
  return {
    filas,
    porElemento,
    fondo,
    taludes,
    total,
    cantidad: r2(total),
    formula: `Afine = fondo ${fmt(fondo)} + taludes ${fmt(taludes)} = ${fmt(total)} m²`,
  }
}
