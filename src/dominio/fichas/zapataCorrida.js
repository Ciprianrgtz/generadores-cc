import { r2, fmt, dato } from '../redondeo.js'

/**
 * Ficha de análisis unitario de zapata corrida — método de la oficina
 * (plantilla "Catálogo de generadores", hoja CIM, bloque CIM05B).
 *
 * Se analiza 1.00 ml de zapata, porque así se paga en obra:
 *   Transversales (sentido corto): n = L ÷ sep + 1, cada una de
 *     (ancho − 2·recubrimiento) + 2·gancho
 *   Longitudinales (sentido largo): n = ancho ÷ sep + 1, cada una de
 *     (L − recubrimiento) + 1·gancho
 *   kg = n × longitud × kg/m × (1 + desperdicio)
 *
 * Todos los criterios llegan como parámetros (son datos, no código).
 */
export const PARAMETROS_OFICINA = {
  longitudAnalisis: 1.0, // m
  recubrimiento: 0.02, // m por lado
  gancho: 0.18, // m por gancho
  desperdicio: 0.03, // fracción
}

export function analizarZapataCorrida({ seccion, transversal, longitudinal, criterios, varillas }) {
  const c = { ...PARAMETROS_OFICINA, ...criterios }
  const L = c.longitudAnalisis
  const B = seccion.ancho
  const vT = varillas[transversal.varilla]
  const vL = varillas[longitudinal.varilla]
  if (!vT || !vL) throw new Error('Varilla sin peso en la tabla de varillas')
  const fd = 1 + c.desperdicio

  const nT = transversal.cantidad ?? L / transversal.separacion + 1
  const lenT = B - 2 * c.recubrimiento + 2 * c.gancho
  const kgTNeto = nT * lenT * vT.kg_m
  const kgT = kgTNeto * fd

  const nL = longitudinal.cantidad ?? B / longitudinal.separacion + 1
  const lenL = L - c.recubrimiento + c.gancho
  const kgLNeto = nL * lenL * vL.kg_m
  const kgL = kgLNeto * fd

  const kgMlNeto = kgTNeto + kgLNeto
  const kgMl = kgT + kgL
  const acero = {}
  acero[transversal.varilla] = (acero[transversal.varilla] ?? 0) + kgT
  acero[longitudinal.varilla] = (acero[longitudinal.varilla] ?? 0) + kgL

  const fdTxt = fmt(fd)
  const pasos = [
    { tipo: 'sub', texto: `Sentido corto: #${transversal.varilla} @ ${dato(transversal.separacion)} repartidas en ${dato(L)} m` },
    {
      id: '1',
      texto: 'Número de varillas',
      formula: transversal.cantidad != null ? 'capturado' : `${dato(L)} ÷ ${dato(transversal.separacion)} + 1`,
      resultado: `${fmt(nT)} pzas`,
    },
    {
      id: '2',
      texto: 'Longitud de cada varilla',
      formula: `(${dato(B)} − 2×${dato(c.recubrimiento)}) + 2×${dato(c.gancho)}`,
      resultado: `${fmt(lenT)} m`,
    },
    {
      id: '3',
      texto: `Peso #${transversal.varilla} con desperdicio`,
      formula: `${fmt(nT)} × ${fmt(lenT)} × ${fmt(vT.kg_m, 3)} × ${fdTxt}`,
      resultado: `${fmt(kgT)} kg`,
    },
    { tipo: 'sub', texto: `Sentido largo: #${longitudinal.varilla} @ ${dato(longitudinal.separacion)} repartidas en ${dato(B)} m` },
    {
      id: '4',
      texto: 'Número de varillas',
      formula: longitudinal.cantidad != null ? 'capturado' : `${dato(B)} ÷ ${dato(longitudinal.separacion)} + 1`,
      resultado: `${fmt(nL)} pzas`,
    },
    {
      id: '5',
      texto: 'Longitud por metro analizado',
      formula: `(${dato(L)} − ${dato(c.recubrimiento)}) + ${dato(c.gancho)}`,
      resultado: `${fmt(lenL)} m`,
    },
    {
      id: '6',
      texto: `Peso #${longitudinal.varilla} con desperdicio`,
      formula: `${fmt(nL)} × ${fmt(lenL)} × ${fmt(vL.kg_m, 3)} × ${fdTxt}`,
      resultado: `${fmt(kgL)} kg`,
    },
    { tipo: 'total', texto: 'Acero por metro lineal', formula: `${fmt(kgT)} + ${fmt(kgL)}`, resultado: `${fmt(kgMl)} kg/ml` },
    {
      tipo: 'nota',
      texto: 'Del cual es desperdicio',
      formula: `${fmt(kgMlNeto)} × ${fmt(c.desperdicio * 100)} %`,
      resultado: `${fmt(kgMl - kgMlNeto)} kg/ml`,
    },
  ]

  return {
    nT, lenT, kgT, nL, lenL, kgL, kgMl, kgMlNeto, acero, pasos, criterios: c,
    varillaT: transversal.varilla, varillaL: longitudinal.varilla, sepT: transversal.separacion, ancho: B,
  }
}

/** Cantidad del generador: ml de zapata × kg/ml de la ficha. */
export function aceroZapata(ml, ficha) {
  const kg = ml * ficha.kgMl
  return { kg: r2(kg), formula: `${dato(ml)} ml × ${fmt(ficha.kgMl)} kg/ml = ${fmt(kg)} kg` }
}

/**
 * Despiece real por tramos (informativo): cada tramo se arma por separado,
 * con ganchos solo en los extremos. No incluye traslapes ni anclajes en esquinas.
 */
export function despieceReal(tramos, ficha, varillas) {
  const c = ficha.criterios
  const fd = 1 + c.desperdicio
  const kgT = varillas[ficha.varillaT].kg_m
  const kgL = varillas[ficha.varillaL].kg_m
  const filas = tramos.map((L) => {
    const nT = Math.ceil(L / ficha.sepT - 1e-9) + 1
    const lenL = L - 2 * c.recubrimiento + 2 * c.gancho
    const kg = (nT * ficha.lenT * kgT + ficha.nL * lenL * kgL) * fd
    return { L, nT, lenL, kg }
  })
  const ml = tramos.reduce((s, L) => s + L, 0)
  const kgReal = filas.reduce((s, f) => s + f.kg, 0)
  const kgPorMetro = ml * ficha.kgMl
  return { filas, ml, kgReal, kgPorMetro, diferencia: kgPorMetro - kgReal }
}
