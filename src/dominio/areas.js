import { fmt, r2 } from './redondeo.js'
import { areaPoligono } from './terreno.js'

/**
 * Suma de áreas: para conceptos que se pagan por la superficie de algo (membrana bajo losa,
 * afine para recibir firme, firme de concreto…). Cada área viene de:
 *   · una superficie del análisis de excavación (losas, firmes), con su forma,
 *   · un polígono importado del DXF, o
 *   · una captura a mano (sin dibujo).
 * Se marca cuáles entran; el total se compara con Neodata.
 */

/** Área de una huella: contornos menos huecos. */
export const areaDeHuella = (huella) =>
  (huella ?? []).reduce((s, [contorno, ...huecos]) => s + areaPoligono(contorno).area - huecos.reduce((t, h) => t + areaPoligono(h).area, 0), 0)

/**
 * Las superficies de un análisis de excavación como áreas. Se usa el área dibujada (completa),
 * no la neta de excavación, que descuenta lo que ya excavan zapatas y trabes.
 */
export function areasDeExcavacion(datosExcavacion, origen) {
  return (datosExcavacion?.superficies ?? [])
    .filter((s) => s.huella?.length || s.area > 0)
    .map((s) => {
      const dibujada = s.huella?.length ? areaDeHuella(s.huella) : null
      return {
        descripcion: s.descripcion,
        area: Math.round((dibujada ?? s.area) * 10000) / 10000,
        nivel: Number.isFinite(s.espesor) ? s.espesor : null, // a qué profundidad queda (para el dibujo)
        huella: s.huella ?? null,
        origen: origen ?? 'excavación',
        incluir: true,
      }
    })
}

export function analizarAreas({ areas = [] }) {
  const filas = areas.map((a) => ({ ...a, valido: a.area > 0 }))
  const usadas = filas.filter((f) => f.valido && f.incluir !== false)
  const total = usadas.reduce((s, f) => s + f.area, 0)
  return {
    filas,
    total,
    cantidad: r2(total),
    formula: `Σ áreas = ${usadas.map((f) => fmt(f.area)).join(' + ') || '0'} = ${fmt(total)} m²`,
  }
}
