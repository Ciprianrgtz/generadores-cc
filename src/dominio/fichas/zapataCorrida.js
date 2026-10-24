import { r2, fmt } from '../redondeo.js'

/**
 * Ficha de análisis unitario de zapata corrida — método de la oficina
 * (plantilla "Catálogo de generadores", hoja CIM, bloque CIM05B).
 *
 * Se analiza 1.00 ml de zapata:
 *   Transversales (sentido corto): n = L ÷ sep + 1, cada una de
 *     (ancho − 2·recubrimiento) + 2·gancho
 *   Longitudinales (sentido largo): n = ancho ÷ sep + 1, cada una de
 *     (L − recubrimiento) + 1·gancho
 *   kg = n × longitud × kg/m × factor de acero
 *
 * Todos los criterios llegan como parámetros (son datos, no código).
 */
export const PARAMETROS_OFICINA = {
  longitudAnalisis: 1.0, // m
  recubrimiento: 0.02, // m por lado
  gancho: 0.18, // m por gancho
  factorAcero: 1.03,
}

export function analizarZapataCorrida({ seccion, transversal, longitudinal, criterios, varillas }) {
  const c = { ...PARAMETROS_OFICINA, ...criterios }
  const L = c.longitudAnalisis
  const B = seccion.ancho
  const vT = varillas[transversal.varilla]
  const vL = varillas[longitudinal.varilla]
  if (!vT || !vL) throw new Error('Varilla sin peso en la tabla de varillas')

  const nT = transversal.cantidad ?? L / transversal.separacion + 1
  const lenT = B - 2 * c.recubrimiento + 2 * c.gancho
  const kgT = nT * lenT * vT.kg_m * c.factorAcero

  const nL = longitudinal.cantidad ?? B / longitudinal.separacion + 1
  const lenL = L - c.recubrimiento + c.gancho
  const kgL = nL * lenL * vL.kg_m * c.factorAcero

  const kgMl = kgT + kgL
  const acero = {}
  acero[transversal.varilla] = (acero[transversal.varilla] ?? 0) + kgT
  acero[longitudinal.varilla] = (acero[longitudinal.varilla] ?? 0) + kgL

  const pasos = [
    { tipo: 'sub', texto: `Sentido corto: #${transversal.varilla} @ ${fmt(transversal.separacion)} repartidas en ${fmt(L)} m` },
    {
      id: '1',
      texto: 'Número de varillas',
      formula: transversal.cantidad != null ? 'capturado' : `${fmt(L)} ÷ ${fmt(transversal.separacion)} + 1`,
      resultado: `${fmt(nT)} pzas`,
    },
    {
      id: '2',
      texto: 'Longitud de cada varilla',
      formula: `(${fmt(B)} − 2×${fmt(c.recubrimiento)}) + 2×${fmt(c.gancho)}`,
      resultado: `${fmt(lenT)} m`,
    },
    {
      id: '3',
      texto: `Peso #${transversal.varilla}`,
      formula: `${fmt(nT)} × ${fmt(lenT)} × ${fmt(vT.kg_m, 3)} × ${fmt(c.factorAcero)}`,
      resultado: `${fmt(kgT)} kg`,
    },
    { tipo: 'sub', texto: `Sentido largo: #${longitudinal.varilla} @ ${fmt(longitudinal.separacion)} repartidas en ${fmt(B)} m` },
    {
      id: '4',
      texto: 'Número de varillas',
      formula: longitudinal.cantidad != null ? 'capturado' : `${fmt(B)} ÷ ${fmt(longitudinal.separacion)} + 1`,
      resultado: `${fmt(nL)} pzas`,
    },
    {
      id: '5',
      texto: 'Longitud por metro analizado',
      formula: `(${fmt(L)} − ${fmt(c.recubrimiento)}) + ${fmt(c.gancho)}`,
      resultado: `${fmt(lenL)} m`,
    },
    {
      id: '6',
      texto: `Peso #${longitudinal.varilla}`,
      formula: `${fmt(nL)} × ${fmt(lenL)} × ${fmt(vL.kg_m, 3)} × ${fmt(c.factorAcero)}`,
      resultado: `${fmt(kgL)} kg`,
    },
    { tipo: 'total', texto: 'Acero por metro lineal', formula: `${fmt(kgT)} + ${fmt(kgL)}`, resultado: `${fmt(kgMl)} kg/ml` },
  ]

  return { nT, lenT, kgT, nL, lenL, kgL, kgMl, acero, pasos, criterios: c }
}

/** Cantidad del generador: ml de zapata × kg/ml de la ficha. */
export function aceroZapata(ml, ficha) {
  const kg = ml * ficha.kgMl
  return { kg: r2(kg), formula: `${fmt(ml)} ml × ${fmt(ficha.kgMl)} kg/ml = ${fmt(kg)} kg` }
}
