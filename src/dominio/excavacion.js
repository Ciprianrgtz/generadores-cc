import { dato, fmt, r2 } from './redondeo.js'

/**
 * Excavación por elementos — método de la oficina (explicado por Ciprian, 26-oct-2026).
 *
 * Se excava todo elemento en contacto con el suelo (zapatas, trabes de liga,
 * contratrabes, plantillas…), sumando el volumen de cada uno:
 *   · No se sigue la forma del elemento en corte: se excava su ANCHO TOTAL
 *     (el más ancho de la sección) por la PROFUNDIDAD hasta su desplante.
 *   · A la profundidad se suma la plantilla de concreto que va debajo (5 cm).
 *   · Al ancho se suma un sobreancho de 10 cm por lado para maniobrar el armado,
 *     el colado y los amarres.
 *   · Si entre dos excavaciones queda menos de 35 cm de tierra, esa franja también
 *     se excava (en obra no se sostiene); su volumen cuenta como excavación y como relleno.
 *
 *   Volumen = largo × (ancho + 2·sobreancho) × (profundidad + plantilla) × piezas
 */
export const CRITERIOS_EXCAVACION = {
  sobreancho: 0.1, // m por lado
  plantilla: 0.05, // m de espesor bajo el elemento
  separacionMinima: 0.35, // m de tierra entre excavaciones
}

const n = (v) => (Number.isFinite(v) ? v : 0)

export function calcularRenglon(r, c) {
  const piezas = r.piezas > 0 ? r.piezas : 1
  const ancho = n(r.ancho) + 2 * c.sobreancho
  const alto = n(r.profundidad) + c.plantilla
  const volumen = n(r.largo) * ancho * alto * piezas
  const valido = r.largo > 0 && r.ancho > 0 && r.profundidad > 0
  const formula =
    `${dato(n(r.largo))} × (${dato(n(r.ancho))} + 2×${dato(c.sobreancho)}) × (${dato(n(r.profundidad))} + ${dato(c.plantilla)})` +
    (piezas !== 1 ? ` × ${dato(piezas)}` : '') +
    ` = ${fmt(volumen)} m³`
  return { ...r, piezas, anchoCepa: ancho, altoCepa: alto, volumen, valido, formula }
}

export function calcularSeparacion(s, c) {
  const entra = s.separacion > 0 && s.separacion < c.separacionMinima
  const alto = n(s.profundidad) + c.plantilla
  const volumen = entra ? n(s.largo) * s.separacion * alto : 0
  const formula = entra
    ? `${dato(n(s.largo))} × ${dato(s.separacion)} × (${dato(n(s.profundidad))} + ${dato(c.plantilla)}) = ${fmt(volumen)} m³`
    : `${dato(n(s.separacion))} m ≥ ${dato(c.separacionMinima)} m: la tierra se deja`
  return { ...s, entra, altoCepa: alto, volumen, formula }
}

export function analizarExcavacion({ renglones = [], separaciones = [], criterios = {} }) {
  const c = { ...CRITERIOS_EXCAVACION, ...criterios }
  const filas = renglones.map((r) => calcularRenglon(r, c))
  const franjas = separaciones.map((s) => calcularSeparacion(s, c))
  const volElementos = filas.reduce((s, f) => s + (f.valido ? f.volumen : 0), 0)
  const volFranjas = franjas.reduce((s, f) => s + f.volumen, 0)
  const total = volElementos + volFranjas

  // resumen por tipo de elemento (ZC, TL, CT…)
  const porElemento = {}
  for (const f of filas) {
    if (!f.valido) continue
    const k = (f.elemento || 'Sin tipo').trim()
    const x = (porElemento[k] ??= { ml: 0, volumen: 0 })
    x.ml += f.largo * f.piezas
    x.volumen += f.volumen
  }

  const partes = [`elementos ${fmt(volElementos)}`]
  if (volFranjas > 0) partes.push(`franjas menores a ${dato(c.separacionMinima)} m ${fmt(volFranjas)}`)
  return {
    criterios: c,
    filas,
    franjas,
    porElemento,
    volElementos,
    volFranjas,
    rellenoFranjas: volFranjas,
    total,
    cantidad: r2(total),
    formula: `Excavación = ${partes.join(' + ')} = ${fmt(total)} m³`,
  }
}
