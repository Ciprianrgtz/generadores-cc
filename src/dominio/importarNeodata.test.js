import { describe, expect, it } from 'vitest'
import { leerCatalogoNeodata } from './importarNeodata.js'

// Filas inventadas con la misma forma del reporte "b) Estándar" (sin datos reales)
const filas = [
  ['Código', 'Concepto', 'Unidad', 'Cantidad', 'P. Unitario', 'Importe', '%'],
  ['RB:', 'CASA DE PRUEBA.'],
  ['ON:', 'OBRA NEGRA.'],
  ['PRE:', 'PRELIMINARES.'],
  ['PRE001', 'LIMPIA Y DESPALME DEL TERRENO', 'M2.', 140, 10, 1400, 0.1],
  ['PRE002', 'TRAZO Y NIVELACIÓN', 'M2.', 140, 5, 700, 0.05],
  ['PRE:', 'TOTAL PRELIMINARES.', null, null, null, 2100, 0.15],
  ['CIM:', 'CIMENTACIÓN.'],
  ['CIM001', 'EXCAVACIÓN', 'M3.', 31, 8, 248, 0.02],
  ['CIM05D’', 'ACERO EN ZAPATA CORRIDA', 'KG.', 155.94, 40, 6237, 0.4],
  ['OG001', 'JORNADA DE LIMPIEZA', 'JOR.', 4, 500, 2000, 0.1],
  ['OG001', 'JORNADA DE LIMPIEZA', 'JOR.', 2, 500, 1000, 0.05],
]

describe('Lectura del catálogo desde el reporte de Neodata', () => {
  const r = leerCatalogoNeodata(filas)

  it('separa partidas y conserva su orden', () => {
    expect(r.partidas.map((p) => p.clave)).toEqual(['PRE', 'CIM'])
    expect(r.partidas[0].descripcion).toBe('PRELIMINARES')
  })

  it('cada concepto queda en su partida, en el orden del presupuesto', () => {
    expect(r.conceptos.filter((c) => c.partida === 'PRE').map((c) => c.clave)).toEqual(['PRE001', 'PRE002'])
    expect(r.conceptos.find((c) => c.clave === 'PRE002').orden).toBe(2)
  })

  it('normaliza la clave con apóstrofo y la unidad', () => {
    const c = r.conceptos.find((x) => x.clave.startsWith('CIM05D'))
    expect(c.clave).toBe("CIM05D'")
    expect(c.unidad).toBe('KG')
  })

  it('un concepto repetido en el presupuesto entra una sola vez', () => {
    expect(r.conceptos.filter((c) => c.clave === 'OG001')).toHaveLength(1)
    expect(r.repetidos).toBe(1)
  })

  it('no guarda precios ni cantidades', () => {
    for (const c of r.conceptos) expect(Object.keys(c).sort()).toEqual(['clave', 'descripcion', 'orden', 'partida', 'unidad'])
  })
})

describe('Reporte "j) Totales por Tipo": encabezados sin clave y datos de la obra arriba', () => {
  const filasJ = [
    ['SU EMPRESA, S.A. DE C.V.'],
    ['Lugar:', 'Sendero Comala-Colima, Residencial de prueba'],
    ['Obra:', 'CONSTRUCCION DE CASA DE PRUEBA'],
    ['Código', 'Concepto', 'Unidad', 'Cantidad', 'MATERIALES', null, null, 'MANO DE OBRA'],
    [null, null, null, null, 'Costo', 'Importe'],
    [null, 'CASA DE PRUEBA.'],
    [null, 'OBRA NEGRA.'],
    [null, 'PRELIMINARES.'],
    ['PRE001', 'LIMPIA Y DESPALME', 'M2.', 140, 10, 1400],
    ['PRE002', 'TRAZO Y NIVELACIÓN', 'M2.', 140, 5, 700],
    [null, 'TOTAL PRELIMINARES.', null, null, 0, 2100],
    [null, 'CIMENTACIÓN.', null, null, 0, 0],
    ['CIM001', 'EXCAVACIÓN', 'M3.', 31, 8, 248],
  ]
  const r = leerCatalogoNeodata(filasJ)

  it('ignora los datos de la obra: "Lugar:" no es una partida', () => {
    expect(r.partidas.map((p) => p.descripcion)).toEqual(['PRELIMINARES', 'CIMENTACIÓN'])
  })

  it('la clave de la partida sale de su primer concepto', () => {
    expect(r.partidas.map((p) => p.clave)).toEqual(['PRE', 'CIM'])
    expect(r.conceptos.map((c) => `${c.partida}/${c.clave}`)).toEqual(['PRE/PRE001', 'PRE/PRE002', 'CIM/CIM001'])
  })
})
