import { describe, expect, it } from 'vitest'
import { analizarAfine, calcularCepa, cepasDeExcavacion } from './afine.js'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'

describe('Afine de fondo y taludes', () => {
  it('fondo + dos taludes de la cepa', () => {
    const f = calcularCepa({ elemento: 'ZC-01', ml: 4.82, ancho: 0.9, profundidad: 0.85 })
    expect(f.fondo).toBeCloseTo(4.82 * 0.9, 10)
    expect(f.taludes).toBeCloseTo(2 * 4.82 * 0.85, 10)
    expect(f.formula).toBe('4.82 × (0.90 + 2×0.85) = 12.53 m²')
  })

  it('las cepas salen de la excavación, con los ml del elemento del plano', () => {
    const cepas = cepasDeExcavacion({ ...EXCAVACION_BIELVA, criterios: {} })
    const zc = cepas.filter((c) => /^ZC/.test(c.elemento))
    expect(zc.reduce((s, c) => s + c.ml, 0)).toBeCloseTo(22.56, 10) // la esquina de X-08 cuenta en los dos tramos
    expect(zc[0].ancho).toBe(0.9)
    expect(zc[0].profundidad).toBe(0.85)
    const tl = cepas.find((c) => c.elemento === 'TL-1')
    expect([tl.ancho, tl.profundidad]).toEqual([0.45, 0.3])
  })

  it('Bielva: zapatas 22.56 × (0.90 + 2×0.85) = 58.66 (Neodata 58.63) y con TL-1 67.71', () => {
    const cepas = cepasDeExcavacion({ ...EXCAVACION_BIELVA, criterios: {} })
    const soloZc = analizarAfine({ cepas: cepas.map((c) => ({ ...c, incluir: /^ZC/.test(c.elemento) })) })
    expect(soloZc.cantidad).toBe(58.66)
    const todo = analizarAfine({ cepas })
    expect(todo.cantidad).toBe(67.71)
    expect(todo.formula).toBe('Afine = fondo 24.18 + taludes 43.52 = 67.71 m²')
  })
})
