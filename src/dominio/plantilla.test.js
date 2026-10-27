import { describe, expect, it } from 'vitest'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'
import { analizarPlantilla, calcularTramo, tramosDeExcavacion } from './plantilla.js'

describe('Plantilla bajo zapatas corridas y trabes de liga', () => {
  it('ml × (ancho de la zapata + 2 × vuelo)', () => {
    const f = calcularTramo({ ml: 4.82, ancho: 0.8 }, { vuelo: 0.05 })
    expect(f.area).toBeCloseTo(4.82 * 0.9, 10)
    expect(f.formula).toBe('4.82 × (0.80 + 2×0.05) = 4.34 m²')
  })

  it('toma de la excavación los ml de zapatas y trabes de liga del plano', () => {
    const tramos = tramosDeExcavacion({ ...EXCAVACION_BIELVA, criterios: {} })
    const zc = tramos.filter((t) => /^ZC/.test(t.elemento))
    expect(tramos.every((t) => t.incluir)).toBe(true)
    expect(zc.reduce((s, t) => s + t.ml, 0)).toBeCloseTo(22.56, 10)
    // en colindancia la zapata va 5 cm más hacia el lindero que el centro de su cepa
    expect(zc[0].desfase).toBe(0.4)
    expect(zc[2].desfase).toBe(-0.4)
  })

  it('Bielva con vuelo de 5 cm: ZC 22.56 × 0.90 + TL 8.62 × 0.35 = 23.32 (Neodata 23.58)', () => {
    const tramos = tramosDeExcavacion({ ...EXCAVACION_BIELVA, criterios: {} })
    expect(analizarPlantilla({ tramos }).cantidad).toBe(23.32)
    expect(analizarPlantilla({ tramos: tramos.map((t) => ({ ...t, incluir: /^ZC/.test(t.elemento) })) }).cantidad).toBe(20.3)
    expect(analizarPlantilla({ tramos, criterios: { vuelo: 0 } }).cantidad).toBe(20.2)
  })
})
