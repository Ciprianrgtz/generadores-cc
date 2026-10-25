/**
 * Lee un reporte de Neodata (ya convertido a filas) y saca solo la estructura
 * del catálogo: partidas y conceptos en su orden, con clave, descripción y
 * unidad. Precios, cantidades e importes se ignoran a propósito: el catálogo
 * no los guarda.
 *
 * Sirve para "b) Estándar" y para "j) Totales por Tipo". La tabla empieza en
 * la fila "Código | Concepto | Unidad | Cantidad…"; lo anterior es el
 * encabezado de la obra (cliente, lugar…) y se ignora. Dentro de la tabla:
 *   RB:  RESIDENCIA BIELVA.        ← encabezado con clave (b)
 *        PRELIMINARES.             ← encabezado sin clave (j): sin unidad ni cantidad
 *   PRE001 | LIMPIA Y DESPALME…    ← concepto
 *   PRE: TOTAL PRELIMINARES.       ← total (se ignora)
 * La partida de un concepto es el último encabezado que lo antecede.
 */
const reConcepto = /^[A-Za-z]{2,6}\d{2,4}[A-Za-z'’*]{0,3}$/
const reCabecera = /^[A-Za-z]{2,6}:$/

const texto = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim())
const sinPunto = (s) => s.replace(/\.+$/, '')
const claveConcepto = (s) => s.toUpperCase().replace(/[’´`]/g, "'")
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

export function leerCatalogoNeodata(filas) {
  const partidas = []
  const conceptos = []
  const vistos = new Set()
  let actual = null
  let repetidos = 0

  const inicio = filas.findIndex((f) => sinAcentos(texto(f[0])) === 'CODIGO')
  for (const fila of filas.slice(inicio + 1)) {
    const a = texto(fila[0])
    const b = texto(fila[1])
    if (!b || /^TOTAL\b/i.test(b)) continue

    // encabezado con clave: "PRE:" · "PRELIMINARES."
    if (reCabecera.test(a)) {
      actual = { clave: a.slice(0, -1).toUpperCase(), descripcion: sinPunto(b) }
      continue
    }
    // encabezado sin clave: sin código, sin unidad y sin cantidad
    if (!a && !texto(fila[2]) && !texto(fila[3])) {
      actual = { clave: null, descripcion: sinPunto(b) }
      continue
    }

    if (reConcepto.test(a)) {
      const clave = claveConcepto(a)
      if (vistos.has(clave)) {
        repetidos++
        continue
      }
      vistos.add(clave)

      const base = actual ?? { clave: null, descripcion: 'GENERAL' }
      let p = partidas.find((x) => x.descripcion === base.descripcion)
      if (!p) {
        // sin clave de partida: se toma de las letras de su primer concepto (PRE001 → PRE)
        let k = base.clave ?? clave.match(/^[A-Z]+/)[0]
        const raiz = k
        for (let n = 2; partidas.some((x) => x.clave === k); n++) k = `${raiz}${n}`
        p = { clave: k, descripcion: base.descripcion, orden: partidas.length + 1 }
        partidas.push(p)
      }
      conceptos.push({
        clave,
        descripcion: b,
        unidad: sinPunto(texto(fila[2])).toUpperCase() || 'PZA',
        partida: p.clave,
        orden: conceptos.filter((c) => c.partida === p.clave).length + 1,
      })
    }
  }
  return { partidas, conceptos, repetidos }
}
