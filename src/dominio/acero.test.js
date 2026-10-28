import { describe, expect, it } from 'vitest'
import { analizarAcero, claveDeElemento, elementoDelConcepto, resumenDeFicha, tramosDeElemento } from './acero.js'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'
import { analizarZapataCorrida } from './fichas/zapataCorrida.js'

const excavacion = { ...EXCAVACION_BIELVA, criterios: {} }
const varillas = { 3: { kg_m: 0.557 }, 4: { kg_m: 0.994 } }

// una ficha guardada tal como la deja la pantalla de la ficha (resultados.kg_ml y acero_kg_ml)
const fichaGuardada = (calc, extra = {}) => ({
  id: 'f1',
  version: 1,
  estado: 'borrador',
  resultados: { kg_ml: calc.kgMl, acero_kg_ml: calc.acero },
  ...extra,
})
const zc01 = analizarZapataCorrida({ seccion: { ancho: 0.8, peralte: 0.2 }, transversal: { varilla: '3', separacion: 0.2 }, longitudinal: { varilla: '3', separacion: 0.2 }, varillas })

describe('Acero por ficha (kg)', () => {
  it('reconoce el elemento de la descripción del concepto', () => {
    expect(elementoDelConcepto("ACERO DE REFUERZO EN ZAPATA CORRIDA ZC-01 DE 80x20 cms. A BASE DE CONCRETO F´c=250 kg/cm2.")).toBe('ZC-1')
    expect(elementoDelConcepto('ACERO DE REFUERZO EN CONTRA TRABE TL-1 DE 25x25 cms. ESTRIBOS DEL N°. 3')).toBe('TL-1')
    expect(elementoDelConcepto('ACERO EN CASTILLO K-A DE 15x15 cms. REFORZADO CON ARMEX')).toBeNull()
    expect(elementoDelConcepto('LIMPIA Y DESPALME DEL TERRENO')).toBeNull()
  })

  it('empareja ZC-01, ZC-1 y zc 1 como el mismo elemento', () => {
    expect(claveDeElemento('ZC-01')).toBe('ZC-1')
    expect(claveDeElemento('zc 1')).toBe('ZC-1')
    expect(claveDeElemento('ZC-02')).not.toBe(claveDeElemento('ZC-01'))
  })

  it('Bielva: ZC-01 son 21.71 ml × 7.182849 kg/ml = 155.94 kg, igual que Neodata (CIM05D′)', () => {
    const tramos = tramosDeElemento(excavacion, 'ZC-01').map((t) => ({ ...t, incluir: t.incluir }))
    const r = analizarAcero({ tramos, ficha: resumenDeFicha(fichaGuardada(zc01)) })
    expect(r.ml).toBeCloseTo(21.71, 10)
    expect(r.cantidad).toBe(155.94)
    expect(r.formula).toBe('21.71 ml × 7.182849 kg/ml = 155.94 kg')
    expect(r.porDiametro['3']).toBeCloseTo(155.94, 1)
  })

  it('Bielva: ZC-02 son 0.85 ml del DXF = 6.11 kg (Neodata trae 5.69 porque multiplica por 0.85 un cálculo que ya era de la pieza)', () => {
    const tramos = tramosDeElemento(excavacion, 'ZC-02')
    const r = analizarAcero({ tramos, ficha: resumenDeFicha(fichaGuardada(zc01)) })
    expect(r.ml).toBeCloseTo(0.85, 10)
    expect(r.cantidad).toBe(6.11)
  })

  it('un tipo nuevo con otra separación y dos números de varilla se resuelve solo con su ficha', () => {
    // sentido corto #4 @ 15 y sentido largo #3 @ 25
    const zc03 = analizarZapataCorrida({ seccion: { ancho: 1.0, peralte: 0.25 }, transversal: { varilla: '4', separacion: 0.15 }, longitudinal: { varilla: '3', separacion: 0.25 }, varillas })
    const tramos = [{ elemento: 'ZC-03', ml: 10, piezas: 1, incluir: true }]
    const r = analizarAcero({ tramos, ficha: resumenDeFicha(fichaGuardada(zc03)) })
    expect(r.total).toBeCloseTo(10 * zc03.kgMl, 10)
    // el desglose por diámetro suma el total y separa #4 de #3
    expect(Object.keys(r.porDiametro).sort()).toEqual(['3', '4'])
    expect(r.porDiametro['3'] + r.porDiametro['4']).toBeCloseTo(r.total, 10)
  })

  it('sin ficha no hay cantidad y lo dice', () => {
    const r = analizarAcero({ tramos: [{ elemento: 'ZC-01', ml: 5, piezas: 1, incluir: true }], ficha: null })
    expect(r.cantidad).toBe(0)
    expect(r.formula).toBe('Falta la ficha del elemento')
    expect(resumenDeFicha({ resultados: {} })).toBeNull()
  })
})
