import { describe, expect, it } from 'vitest'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'
import { analizarLongitud, calcularTramo, elementosDelConcepto, tramosPorLongitud } from './longitud.js'

const excavacion = { ...EXCAVACION_BIELVA, criterios: {} }

describe('Longitud de elementos (cimbra de zapatas corridas, trabes de liga…)', () => {
  it('cada tramo vale su ml por sus piezas', () => {
    expect(calcularTramo({ ml: 4.82 }).total).toBe(4.82)
    expect(calcularTramo({ ml: 2, piezas: 3 }).formula).toBe('2.00 × 3.00 = 6.00 ml')
    expect(calcularTramo({ ml: 0 }).valido).toBe(false)
  })

  it('Bielva: la cimbra de zapatas corridas da 22.56 ml, igual que Neodata (CIM004)', () => {
    const patron = elementosDelConcepto('CIMBRADO DE ZAPATAS CORRIDAS, CON FRONTERA HABILITADA A BASE DE TABLAS')
    const r = analizarLongitud({ tramos: tramosPorLongitud(excavacion, patron) })
    expect(r.cantidad).toBe(22.56)
    expect(r.formula).toBe('Σ ml = 4.82 + 4.60 + 4.97 + 0.85 + 4.76 + 2.56 = 22.56 ml')
  })

  it('con solo las trabes de liga da los 8.62 ml del plano (Neodata trae 8.97)', () => {
    const patron = elementosDelConcepto('CIMBRADO, COLADO Y DESCIMBRADO DE CONTRA TRABE TL-1 DE 25x25')
    expect(analizarLongitud({ tramos: tramosPorLongitud(excavacion, patron) }).cantidad).toBe(8.62)
  })

  it('un concepto sin elemento reconocido empieza sin tramos marcados', () => {
    expect(elementosDelConcepto('DALA DE DESPLANTE DD-1')).toBeNull()
    const tramos = tramosPorLongitud(excavacion, null)
    expect(tramos.every((t) => t.incluir === false)).toBe(true)
    expect(analizarLongitud({ tramos }).cantidad).toBe(0)
  })

  it('un tramo agregado a mano suma, y uno sin marcar no', () => {
    const tramos = [
      { elemento: 'CT-1', ml: 22.56, piezas: 1, incluir: true, manual: true },
      { elemento: 'ZC-01', ml: 5, incluir: false },
    ]
    expect(analizarLongitud({ tramos }).cantidad).toBe(22.56)
  })
})
