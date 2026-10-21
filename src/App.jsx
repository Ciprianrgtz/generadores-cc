import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from './lib/supabase'

function useVarillas() {
  const [estado, setEstado] = useState({ cargando: supabaseConfigurado, error: null, datos: [] })

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('varillas')
      .select('id, diametro_pulg, diametro_mm, kg_m, fuente, confirmado')
      .order('orden')
      .then(({ data, error }) => setEstado({ cargando: false, error, datos: data ?? [] }))
  }, [])

  return estado
}

function Conexion({ cargando, error, total }) {
  if (!supabaseConfigurado)
    return <Aviso color="bg-st-par">Falta configurar Supabase en .env.local</Aviso>
  if (cargando) return <Aviso color="bg-st-sin">Conectando…</Aviso>
  if (error) return <Aviso color="bg-st-err">Error: {error.message}</Aviso>
  return <Aviso color="bg-st-ok">Conectado · {total} varillas</Aviso>
}

function Aviso({ color, children }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {children}
    </span>
  )
}

export default function App() {
  const varillas = useVarillas()

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">Generadores y Presupuestos</h1>
          <p className="text-sm text-slate-500">Concepto Cero Arquitectura</p>
        </div>
        <Conexion {...varillas} total={varillas.datos.length} />
      </header>

      <main className="mx-auto max-w-3xl p-4">
        <section className="rounded-lg border border-slate-300 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tabla de varillas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Número</th>
                  <th className="px-4 py-2">Diámetro</th>
                  <th className="px-4 py-2 text-right">mm</th>
                  <th className="px-4 py-2 text-right">kg/m</th>
                  <th className="px-4 py-2">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {varillas.datos.map((v) => (
                  <tr key={v.id} className="border-t border-slate-200">
                    <td className="num px-4 py-2">#{v.id}</td>
                    <td className="px-4 py-2">{v.diametro_pulg}</td>
                    <td className="num px-4 py-2 text-right">{Number(v.diametro_mm).toFixed(1)}</td>
                    <td className="num px-4 py-2 text-right">{Number(v.kg_m).toFixed(3)}</td>
                    <td className="px-4 py-2">
                      <span className={v.confirmado ? 'text-st-ok' : 'text-st-par'}>
                        {v.confirmado ? 'confirmado' : v.fuente}
                      </span>
                    </td>
                  </tr>
                ))}
                {!varillas.datos.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Sin datos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
