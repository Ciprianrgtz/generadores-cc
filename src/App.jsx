import { useState } from 'react'
import { supabaseConfigurado } from './lib/supabase'
import { useVarillas } from './lib/useVarillas'
import { useSesion, salir } from './lib/useSesion'
import FichaZapataCorrida from './componentes/FichaZapataCorrida'
import Login from './componentes/Login'

const ROLES = { lectura: 'Solo lectura', captura: 'Captura', revision: 'Revisión', aprobacion: 'Aprobación' }

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

function TablaVarillas({ datos }) {
  return (
    <section className="max-w-3xl rounded-lg border border-slate-300 bg-white">
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
            {datos.map((v) => (
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
            {!datos.length && (
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
  )
}

const VISTAS = [
  ['ficha-zc', 'Ficha · Zapata corrida'],
  ['varillas', 'Varillas'],
]

export default function App() {
  const varillas = useVarillas()
  const { sesion, perfil, cargando } = useSesion()
  const [vista, setVista] = useState('ficha-zc')

  const encabezado = (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3">
      <div>
        <h1 className="text-xl font-bold">Generadores y Presupuestos</h1>
        <p className="text-sm text-slate-500">Concepto Cero Arquitectura · Casa Bielva</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Conexion {...varillas} total={varillas.datos.length} />
        {sesion && (
          <span className="flex items-center gap-2 text-sm">
            <span>
              <b>{perfil?.nombre ?? sesion.user.email}</b>
              {perfil && <span className="text-slate-500"> · {ROLES[perfil.rol]}</span>}
            </span>
            <button onClick={salir} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
              Salir
            </button>
          </span>
        )}
      </div>
    </header>
  )

  if (cargando) return encabezado
  if (supabaseConfigurado && !sesion)
    return (
      <div className="min-h-screen">
        {encabezado}
        <Login />
      </div>
    )

  return (
    <div className="min-h-screen">
      {encabezado}

      <nav className="flex gap-1 border-b border-slate-300 bg-white px-4">
        {VISTAS.map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              vista === id ? 'border-acento text-acento' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {nombre}
          </button>
        ))}
      </nav>

      <main className="p-4">
        {vista === 'ficha-zc' && <FichaZapataCorrida varillas={varillas.datos} perfil={perfil} />}
        {vista === 'varillas' && <TablaVarillas datos={varillas.datos} />}
      </main>
    </div>
  )
}
