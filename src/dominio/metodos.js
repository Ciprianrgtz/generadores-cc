/**
 * Métodos de análisis: cómo se genera el volumen de cada tipo de concepto.
 * Los usa la página de métodos (la biblioteca) y el bloque "Cómo se genera el volumen"
 * que se ve al abrir un concepto de un proyecto.
 */
export const METODOS = {
  terreno: {
    id: 'terreno',
    nombre: 'Superficie del terreno',
    aplica: 'Limpia y despalme, trazo y nivelación y todo lo que se mide por la superficie del terreno.',
    unidad: 'm²',
    pasos: [
      'Se toma la superficie del terreno del proyecto (se captura una sola vez y la usan todos los conceptos).',
      'Terreno regular: ancho × largo. Terreno irregular: vértices en metros, o una polilínea cerrada de AutoCAD en la capa «terreno» (fórmula de la lazada: ½ × |Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|).',
      'La cantidad del concepto es esa superficie, en m².',
      'El terreno queda guardado en el proyecto y se dibuja en el modelo 3D.',
      'Se compara con la cantidad que trae Neodata para detectar diferencias.',
    ],
    criterios: 'No lleva criterios de la oficina: solo las medidas del terreno. Del DXF se respeta la unidad del dibujo (metros, centímetros o milímetros).',
  },
  zapata_corrida: {
    id: 'zapata_corrida',
    nombre: 'Zapata corrida (acero de la parrilla)',
    aplica: 'Acero de refuerzo de zapatas corridas (ZC-01, ZC-02…). Se analiza por 1.00 m de zapata, porque así se paga en obra.',
    unidad: 'kg',
    pasos: [
      'Sentido corto (transversal): varillas = 1.00 ÷ separación + 1; cada una mide (ancho − 2 × recubrimiento) + 2 × gancho.',
      'Sentido largo (longitudinal): varillas = ancho ÷ separación + 1; cada una mide (1.00 − recubrimiento) + gancho.',
      'Peso = varillas × largo × kg/m × (1 + desperdicio). Se suma el de los dos sentidos: kg por metro lineal.',
      'Cantidad del generador = metros lineales de zapata × kg por metro lineal.',
      'Se compara con Neodata y, como comparativo informativo, con el despiece real por tramos del DXF.',
    ],
    criterios: 'Criterios editables en la ficha: recubrimiento por lado, gancho por lado y desperdicio. La ficha tiene versiones y flujo Borrador → Revisado → Aprobado.',
    abrir: true,
  },
  excavacion: {
    id: 'excavacion',
    nombre: 'Excavación por elementos',
    aplica: 'Excavación de cepas: zapatas, trabes de liga, contratrabes, plantillas y todo elemento en contacto con el suelo.',
    unidad: 'm³',
    pasos: [
      'Un renglón por cada tramo de elemento que toca el suelo, ubicado por eje y entre ejes: largo, ancho total y profundidad de desplante.',
      'No se sigue la forma del elemento en corte: se excava su ancho total (el más ancho de la sección) hasta su desplante.',
      'Ancho de la cepa = ancho total + 2 × sobreancho (10 cm por lado, para maniobrar el armado, el colado y los amarres).',
      'Profundidad de la cepa = desplante + plantilla de concreto (5 cm).',
      'Volumen del renglón = largo × ancho de la cepa × profundidad de la cepa × piezas. La excavación es la suma de todos los renglones.',
      'Zapatas: el alto es la suma de lo que lleva encima hasta el NTN ±0.00 (zapata + muro de enrase + dala de desplante); esos elementos solo dan altura, el ancho es el de la zapata. En colindancia el sobreancho va de un solo lado (no se excava hacia el lindero). Las contratrabes que caen dentro de la cepa no se vuelven a excavar.',
      'Losa de cimentación con talud (CI, CC): ancho total × alto total, sin seguir los taludes y sin sobreancho ni plantilla. Ej. CI-1: 0.25 × (0.40 + 0.10 + 0.10). La CT-2 que va dentro ya queda incluida. La losa no lleva plantilla: la sustituye un plástico o membrana que no cuenta en la profundidad.',
      'El firme no se excava en la cochera (es otro concepto) y su área es neta: sin lo que ya excavan zapatas, trabes y losas.',
      'El firme de concreto (10 cm) que va en toda el área interior de la casa se excava por superficie: área × espesor, sin sobreancho ni plantilla.',
      'Si entre dos cepas queda menos de 35 cm de tierra, la franja también se excava: su volumen se suma a la excavación y al relleno.',
      'Se compara con la cantidad que trae Neodata.',
    ],
    criterios: 'Criterios editables en el análisis: sobreancho por lado (0.10 m), plantilla (0.05 m) y separación mínima de tierra entre cepas (0.35 m).',
  },
}

export const LISTA_METODOS = Object.values(METODOS)

/** Resumen en una línea de un análisis de excavación guardado. */
export function origenExcavacion(datos) {
  if (!datos?.renglones) return null
  const tipos = [...new Set(datos.renglones.map((r) => (r.elemento || '').trim()).filter(Boolean))]
  const f = datos.separaciones?.length ?? 0
  const s = datos.superficies?.length ?? 0
  return `${datos.renglones.length} renglones (${tipos.join(', ') || 'sin tipo'})${s ? ` · ${s} superficies` : ''}${f ? ` · ${f} franjas revisadas` : ''}`
}

/** Cómo se dio el terreno en un análisis guardado, escrito en una línea. */
export function origenTerreno(datos) {
  if (!datos) return null
  if (datos.modo === 'rectangulo') return `Rectángulo de ${datos.ancho} m × ${datos.largo} m`
  const n = datos.vertices?.length ?? 0
  return datos.origen
    ? `Polilínea de ${n} vértices del DXF «${datos.origen.archivo}» (capa ${datos.origen.capa}, dibujo en ${datos.origen.unidad})`
    : `Polígono de ${n} vértices capturados a mano`
}
