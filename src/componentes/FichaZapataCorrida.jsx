import { useMemo, useState } from 'react'
import { analizarZapataCorrida, aceroZapata, despieceReal } from '../dominio/fichas/zapataCorrida'
import { fmt, r2 } from '../dominio/redondeo'
import { varillasPorId } from '../lib/useVarillas'

// Datos de Casa Bielva: estructural (ZC-1 0.80 × 0.20), plantilla CIM05B y tramos medidos en el DXF
const INICIAL = {
  codigo: 'ZC-01',
  ancho: 0.8,
  peralte: 0.2,
  varillaT: '3',
  sepT: 0.2,
  varillaL: '3',
  sepL: 0.2,
  recubrimiento: 0.02,
  gancho: 0.18,
  desperdicio: 3,
  ml: 21.71,
  tramos: '4.82, 4.60, 4.97, 4.76, 2.56',
  referencia: 155.94,
}

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function Campo({ etiqueta, children }) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      {etiqueta}
      {children}
    </label>
  )
}

const claseInput =
  'num w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-acento focus:outline-none'

function Numero({ valor, onChange, paso = 0.01 }) {
  return <input type="number" step={paso} min="0" value={valor} onChange={(e) => onChange(e.target.value)} className={claseInput} />
}

function Grupo({ titulo, children }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-slate-300 p-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</legend>
      {children}
    </fieldset>
  )
}

export default function FichaZapataCorrida({ varillas }) {
  const [f, setF] = useState(INICIAL)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const tabla = useMemo(() => varillasPorId(varillas), [varillas])

  const resultado = useMemo(() => {
    if (!tabla[f.varillaT] || !tabla[f.varillaL] || num(f.sepT) <= 0 || num(f.sepL) <= 0) return null
    const ficha = analizarZapataCorrida({
      seccion: { ancho: num(f.ancho), peralte: num(f.peralte) },
      transversal: { varilla: f.varillaT, separacion: num(f.sepT) },
      longitudinal: { varilla: f.varillaL, separacion: num(f.sepL) },
      criterios: { recubrimiento: num(f.recubrimiento), gancho: num(f.gancho), desperdicio: num(f.desperdicio) / 100 },
      varillas: tabla,
    })
    const tramos = String(f.tramos).split(/[,;\s]+/).map(num).filter((n) => n > 0)
    return {
      ficha,
      generador: aceroZapata(num(f.ml), ficha),
      despiece: tramos.length ? despieceReal(tramos, ficha, tabla) : null,
    }
  }, [f, tabla])

  if (!varillas.length) return <p className="p-4 text-sm text-slate-500">Cargando tabla de varillas…</p>

  const selVarilla = (k) => (
    <select value={f[k]} onChange={(e) => set(k)(e.target.value)} className={claseInput}>
      {varillas.map((v) => (
        <option key={v.id} value={v.id}>
          #{v.id} ({Number(v.kg_m).toFixed(3)} kg/m)
        </option>
      ))}
    </select>
  )

  const ref = num(f.referencia)
  const cuadra = resultado && ref > 0 && Math.abs(resultado.generador.kg - ref) < 0.005

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()}>
        <p className="text-xs text-slate-500">
          Zapata corrida <b className="num text-slate-700">{f.codigo}</b> · análisis por 1.00 ml · método de la plantilla de generadores
        </p>
        <Grupo titulo="Sección">
          <Campo etiqueta="Ancho (m)"><Numero valor={f.ancho} onChange={set('ancho')} /></Campo>
          <Campo etiqueta="Peralte (m)"><Numero valor={f.peralte} onChange={set('peralte')} /></Campo>
        </Grupo>
        <Grupo titulo="Sentido corto (transversal)">
          <Campo etiqueta="Varilla">{selVarilla('varillaT')}</Campo>
          <Campo etiqueta="Separación (m)"><Numero valor={f.sepT} onChange={set('sepT')} /></Campo>
        </Grupo>
        <Grupo titulo="Sentido largo (longitudinal)">
          <Campo etiqueta="Varilla">{selVarilla('varillaL')}</Campo>
          <Campo etiqueta="Separación (m)"><Numero valor={f.sepL} onChange={set('sepL')} /></Campo>
        </Grupo>
        <Grupo titulo="Criterios">
          <Campo etiqueta="Recubrimiento por lado (m)"><Numero valor={f.recubrimiento} onChange={set('recubrimiento')} paso={0.005} /></Campo>
          <Campo etiqueta="Gancho por lado (m)"><Numero valor={f.gancho} onChange={set('gancho')} /></Campo>
          <Campo etiqueta="Desperdicio (%)"><Numero valor={f.desperdicio} onChange={set('desperdicio')} paso={0.5} /></Campo>
        </Grupo>
        <Grupo titulo="Generador">
          <Campo etiqueta="ml de zapata"><Numero valor={f.ml} onChange={set('ml')} /></Campo>
          <Campo etiqueta="Referencia Neodata (kg)"><Numero valor={f.referencia} onChange={set('referencia')} /></Campo>
          <div className="col-span-2">
            <Campo etiqueta="Tramos medidos para el despiece real (m)">
              <input value={f.tramos} onChange={(e) => set('tramos')(e.target.value)} className={claseInput} />
            </Campo>
          </div>
        </Grupo>
      </form>

      {resultado && (
        <div className="grid content-start gap-4 min-w-0">
          <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">Paso</th>
                  <th className="px-3 py-2">Cálculo</th>
                  <th className="px-3 py-2 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {resultado.ficha.pasos.map((p, i) =>
                  p.tipo === 'sub' ? (
                    <tr key={i} className="bg-slate-100">
                      <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.texto}</td>
                    </tr>
                  ) : (
                    <tr key={i} className={`border-t border-slate-200 ${p.tipo === 'total' ? 'bg-sky-50 font-bold' : ''} ${p.tipo === 'nota' ? 'text-slate-500' : ''}`}>
                      <td className="num px-3 py-1.5 text-xs text-slate-400">{p.tipo === 'total' ? 'Σ' : p.id ?? ''}</td>
                      <td className="px-3 py-1.5">{p.texto}</td>
                      <td className="num px-3 py-1.5 text-xs text-slate-500">{p.formula}</td>
                      <td className="num px-3 py-1.5 text-right whitespace-nowrap">{p.resultado}</td>
                    </tr>
                  ),
                )}
                <tr className="bg-slate-100">
                  <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aplicado al generador</td>
                </tr>
                <tr className="border-t border-slate-200 font-bold">
                  <td className="num px-3 py-2 text-xs text-slate-400">→</td>
                  <td className="px-3 py-2">Acero de {f.codigo}</td>
                  <td className="num px-3 py-2 text-xs font-normal text-slate-500">{resultado.generador.formula}</td>
                  <td className="num px-3 py-2 text-right whitespace-nowrap">{fmt(resultado.generador.kg)} kg</td>
                </tr>
              </tbody>
            </table>
          </div>

          {ref > 0 && (
            <div className={`rounded-md border border-l-4 bg-white px-3 py-2 text-sm ${cuadra ? 'border-st-ok' : 'border-st-err'}`}>
              <b className={cuadra ? 'text-st-ok' : 'text-st-err'}>{cuadra ? '✓ Cuadra con Neodata' : '✗ No cuadra con Neodata'}</b>
              <span className="num ml-2 text-slate-600">
                ficha {fmt(resultado.generador.kg)} kg · Neodata {fmt(ref)} kg
                {!cuadra && ` · Δ ${fmt(resultado.generador.kg - ref)} kg`}
              </span>
            </div>
          )}

          {resultado.despiece && (
            <div className="rounded-lg border border-slate-300 bg-white">
              <div className="border-b border-slate-200 px-3 py-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Comparativo informativo: despiece real por tramos</h3>
                <p className="text-xs text-slate-500">
                  Cada tramo armado por separado, ganchos solo en los extremos. No incluye traslapes ni anclajes en esquinas. No modifica la cantidad del generador.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Tramo</th>
                      <th className="px-3 py-2 text-right">L (m)</th>
                      <th className="px-3 py-2 text-right">Varillas cortas</th>
                      <th className="px-3 py-2 text-right">Largo varilla larga</th>
                      <th className="px-3 py-2 text-right">kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.despiece.filas.map((t, i) => (
                      <tr key={i} className="border-t border-slate-200">
                        <td className="num px-3 py-1.5">{i + 1}</td>
                        <td className="num px-3 py-1.5 text-right">{fmt(t.L)}</td>
                        <td className="num px-3 py-1.5 text-right">{t.nT}</td>
                        <td className="num px-3 py-1.5 text-right">{fmt(t.lenL)}</td>
                        <td className="num px-3 py-1.5 text-right">{fmt(t.kg)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-400 font-semibold">
                      <td className="px-3 py-1.5">Despiece real</td>
                      <td className="num px-3 py-1.5 text-right">{fmt(resultado.despiece.ml)}</td>
                      <td colSpan={2}></td>
                      <td className="num px-3 py-1.5 text-right">{fmt(resultado.despiece.kgReal)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5" colSpan={4}>Análisis por metro ({fmt(resultado.despiece.ml)} ml × {fmt(resultado.ficha.kgMl)} kg/ml)</td>
                      <td className="num px-3 py-1.5 text-right">{fmt(resultado.despiece.kgPorMetro)}</td>
                    </tr>
                    <tr className="text-st-par">
                      <td className="px-3 py-1.5" colSpan={4}>
                        Diferencia (lo que cubre el método por metro además del {fmt(num(f.desperdicio))} % de desperdicio)
                      </td>
                      <td className="num px-3 py-1.5 text-right">
                        {fmt(resultado.despiece.diferencia)} · {fmt(r2((resultado.despiece.diferencia / resultado.despiece.kgReal) * 100))} %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
