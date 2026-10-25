import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Boton, Chip, Seccion, Tarjeta } from './ui'

/**
 * Métodos de análisis: la biblioteca de CÓMO se analiza cada tipo de concepto.
 * Cada concepto del paquete de un proyecto se liga a uno de estos métodos y de él
 * sale su volumen. Aquí queda escrito el método con su fórmula, para que cualquiera
 * que ayude con los generadores entienda qué se hace y por qué.
 */
const METODOS = [
  {
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
  {
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
]

export default function Metodos({ onAbrirZapata }) {
  const [usos, setUsos] = useState({}) // conceptos que usan cada método, en todos los proyectos
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('paquete_conceptos')
      .select('analisis_tipo')
      .not('analisis_tipo', 'is', null)
      .then(({ data, error: e }) => {
        if (e) return setError(e.message)
        const c = {}
        for (const x of data) c[x.analisis_tipo] = (c[x.analisis_tipo] ?? 0) + 1
        setUsos(c)
      })
  }, [])

  return (
    <div className="grid max-w-5xl gap-4">
      <div>
        <h2 className="text-xl font-bold">Métodos de análisis</h2>
        <p className="mt-1 text-sm text-cc-suave">
          La biblioteca de cómo se analiza cada tipo de concepto. En el paquete de un proyecto eliges el método de cada concepto y de él sale su volumen.
          Cada método nuevo se agrega aquí, concepto por concepto.
        </p>
      </div>
      {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}

      {METODOS.map((m) => (
        <Tarjeta key={m.id} className="grid gap-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold">{m.nombre}</h3>
            <Chip color="verde">Volumen en {m.unidad}</Chip>
            <span className="num ml-auto text-xs text-cc-suave">
              {usos[m.id] ? `${usos[m.id]} concepto${usos[m.id] === 1 ? '' : 's'} lo usa${usos[m.id] === 1 ? '' : 'n'}` : 'Aún no lo usa ningún concepto'}
            </span>
          </div>
          <p className="text-sm text-cc-suave">{m.aplica}</p>
          <div>
            <Seccion>Cómo se analiza</Seccion>
            <ol className="mt-2 grid gap-1.5 text-sm">
              {m.pasos.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num w-5 shrink-0 text-cc-tenue">{i + 1}.</span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-cc-suave">
            <b className="text-cc-texto">Criterios.</b> {m.criterios}
          </p>
          {m.abrir && (
            <div>
              <Boton variante="pri" onClick={onAbrirZapata}>Abrir la ficha de zapata corrida</Boton>
            </div>
          )}
        </Tarjeta>
      ))}
    </div>
  )
}
