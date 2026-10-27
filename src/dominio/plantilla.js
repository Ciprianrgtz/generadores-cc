import { calcularRenglon, CRITERIOS_EXCAVACION } from './excavacion.js'
import { dato, fmt, r2 } from './redondeo.js'

/**
 * Plantilla de concreto bajo zapatas corridas y trabes de liga (CIM003) — método de la oficina (Ciprian, 26-oct-2026).
 *
 * Se calcula con los ml de zapatas corridas y trabes de liga del plano:
 *   Área = ml × (ancho del elemento + 2 × vuelo) × piezas
 *   · Los tramos salen del análisis de excavación (ZC y TL entran solos; los
 *     demás, como contratrabes, se pueden agregar con su casilla).
 *   · El vuelo (lo que la plantilla sobresale del elemento por lado) es un criterio editable.
 *   · La losa de cimentación no lleva plantilla: la sustituye un plástico o membrana.
 */
export const CRITERIOS_PLANTILLA = { vuelo: 0.05, espesor: 0.05 }

// zapatas corridas y trabes de liga llevan plantilla de entrada
const llevaPlantilla = (elemento) => /^(ZC|TL)/i.test(String(elemento ?? '').trim())

/** Tramos que pueden llevar plantilla, tomados de un análisis de excavación guardado. */
export function tramosDeExcavacion(datosExcavacion) {
  const c = { ...CRITERIOS_EXCAVACION, ...datosExcavacion?.criterios }
  return (datosExcavacion?.renglones ?? [])
    .map((r) => calcularRenglon(r, c))
    .filter((f) => f.valido && f.plantilla !== false)
    .map((f) => {
      // el centro de la zapata: en colindancia la cepa se corre hacia adentro medio sobreancho
      const corrimiento = f.lados === 1 && Number.isFinite(f.desfase) ? Math.sign(f.desfase) * (c.sobreancho / 2) : 0
      return {
        elemento: f.elemento,
        eje: f.eje,
        entre: f.entre,
        ml: Number.isFinite(f.mlElemento) && f.mlElemento > 0 ? f.mlElemento : f.largo,
        ancho: f.ancho,
        piezas: f.piezas,
        profundidad: Math.round(f.altoCepa * 10000) / 10000, // la plantilla va en el fondo de la cepa
        desplante: f.profundidad, // dónde apoya el elemento, medido desde el NTN
        desfase: Number.isFinite(f.desfase) ? Math.round((f.desfase - corrimiento) * 10000) / 10000 : null,
        inicio: Number.isFinite(f.inicio) ? f.inicio : null,
        incluir: llevaPlantilla(f.elemento),
      }
    })
}

export function calcularTramo(r, c) {
  const piezas = r.piezas > 0 ? r.piezas : 1
  const anchoPlantilla = r.ancho + 2 * c.vuelo
  const area = r.ml * anchoPlantilla * piezas
  const valido = r.ml > 0 && r.ancho > 0
  const formula = `${dato(r.ml)} × (${dato(r.ancho)} + 2×${dato(c.vuelo)})${piezas !== 1 ? ` × ${dato(piezas)}` : ''} = ${fmt(area)} m²`
  return { ...r, piezas, anchoPlantilla, area, valido, formula }
}

export function analizarPlantilla({ tramos = [], criterios = {} }) {
  const c = { ...CRITERIOS_PLANTILLA, ...criterios }
  const filas = tramos.map((t) => calcularTramo(t, c))
  const usadas = filas.filter((f) => f.valido && f.incluir !== false)
  const total = usadas.reduce((s, f) => s + f.area, 0)
  const ml = usadas.reduce((s, f) => s + f.ml * f.piezas, 0)
  return {
    criterios: c,
    filas,
    ml,
    total,
    cantidad: r2(total),
    formula: `Plantilla = ${usadas.map((f) => fmt(f.area)).join(' + ') || '0'} = ${fmt(total)} m² (${fmt(ml)} ml)`,
  }
}
