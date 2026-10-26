import { describe, expect, it } from 'vitest'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'
import { analizarExcavacion, calcularRenglon, CRITERIOS_EXCAVACION as C } from './excavacion.js'

describe('Excavación por elementos', () => {
  it('ancho total + 10 cm por lado y profundidad + 5 cm de plantilla', () => {
    const f = calcularRenglon({ elemento: 'ZC', largo: 4.82, ancho: 0.8, profundidad: 0.8 }, C)
    expect(f.anchoCepa).toBeCloseTo(1.0, 10)
    expect(f.altoCepa).toBeCloseTo(0.85, 10)
    expect(f.volumen).toBeCloseTo(4.82 * 1.0 * 0.85, 10)
    expect(f.formula).toBe('4.82 × (0.80 + 2×0.10) × (0.80 + 0.05) = 4.10 m³')
  })

  it('zapata corrida de Bielva: 22.56 ml dan 19.18 m³', () => {
    const tramos = [4.82, 4.6, 4.97, 0.85, 4.76, 2.56]
    const r = analizarExcavacion({ renglones: tramos.map((largo) => ({ elemento: 'ZC', largo, ancho: 0.8, profundidad: 0.8 })) })
    expect(r.porElemento.ZC.ml).toBeCloseTo(22.56, 10)
    expect(r.cantidad).toBe(19.18)
  })

  it('una franja de tierra menor a 35 cm se excava; una de 35 cm o más se deja', () => {
    const r = analizarExcavacion({
      renglones: [{ elemento: 'TL', largo: 3, ancho: 0.25, profundidad: 0.3 }],
      separaciones: [
        { descripcion: 'entre ZC y TL', largo: 3, separacion: 0.3, profundidad: 0.3 },
        { descripcion: 'entre TL y CT', largo: 3, separacion: 0.35, profundidad: 0.3 },
      ],
    })
    expect(r.franjas[0].entra).toBe(true)
    expect(r.franjas[0].volumen).toBeCloseTo(3 * 0.3 * 0.35, 10)
    expect(r.franjas[1].entra).toBe(false)
    expect(r.volFranjas).toBeCloseTo(0.315, 10)
    expect(r.rellenoFranjas).toBeCloseTo(0.315, 10)
    expect(r.total).toBeCloseTo(3 * 0.45 * 0.35 + 0.315, 10)
  })

  it('los criterios se pueden cambiar', () => {
    const r = analizarExcavacion({
      renglones: [{ elemento: 'ZC', largo: 1, ancho: 0.8, profundidad: 0.8 }],
      criterios: { sobreancho: 0.15, plantilla: 0.1 },
    })
    expect(r.total).toBeCloseTo(1 * 1.1 * 0.9, 10)
  })

  it('un renglón incompleto no suma', () => {
    const r = analizarExcavacion({ renglones: [{ elemento: 'CT', largo: 5, ancho: 0, profundidad: 0.5 }] })
    expect(r.filas[0].valido).toBe(false)
    expect(r.total).toBe(0)
  })

  it('losa con talud CI-1: ancho total × alto total, sin sobreancho ni plantilla', () => {
    const f = calcularRenglon({ elemento: 'CI-1', largo: 10, ancho: 0.6, profundidad: 0.25, lados: 0, plantilla: false }, C)
    expect(f.volumen).toBeCloseTo(10 * 0.6 * 0.25, 10)
    expect(f.formula).toBe('10.00 × 0.60 × 0.25 = 1.50 m³')
    // análisis guardado con la casilla anterior
    expect(calcularRenglon({ largo: 1, ancho: 0.6, profundidad: 0.25, sobreancho: false, plantilla: false }, C).lados).toBe(0)
  })

  it('zapata en colindancia: sobreancho de un solo lado', () => {
    const f = calcularRenglon({ elemento: 'ZC-01', largo: 4.82, ancho: 0.8, profundidad: 0.8, lados: 1 }, C)
    expect(f.anchoCepa).toBeCloseTo(0.9, 10)
    expect(f.formula).toBe('4.82 × (0.80 + 0.10) × (0.80 + 0.05) = 3.69 m³')
  })

  it('Casa Bielva completa (zapatas en colindancia, TL-1, losas y firme sin cochera): 30.88 m³', () => {
    const r = analizarExcavacion(EXCAVACION_BIELVA)
    expect(r.porElemento['ZC-01'].ml + r.porElemento['ZC-02'].ml).toBeCloseTo(21.66, 10)
    expect(r.volElementos).toBeCloseTo(21.66 * 0.9 * 0.85 + 8.62 * 0.45 * 0.3, 10)
    expect(r.cantidad).toBe(30.88)
    expect(Math.abs(r.cantidad - EXCAVACION_BIELVA.referencia)).toBeLessThan(0.3) // Neodata 31.13
  })

  it('el firme se excava por área × espesor, sin sobreancho ni plantilla', () => {
    const r = analizarExcavacion({
      renglones: [{ elemento: 'ZC', largo: 1, ancho: 0.8, profundidad: 0.8 }],
      superficies: [{ descripcion: 'Firme interior', area: 100, espesor: 0.1 }],
    })
    expect(r.areas[0].formula).toBe('100.00 m² × 0.10 = 10.00 m³')
    expect(r.volSuperficies).toBeCloseTo(10, 10)
    expect(r.total).toBeCloseTo(0.85 + 10, 10)
    expect(r.formula).toBe('Excavación = elementos 0.85 + superficies 10.00 = 10.85 m³')
  })
})
