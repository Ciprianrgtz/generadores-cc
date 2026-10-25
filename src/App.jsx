import { useState } from 'react'
import { supabaseConfigurado } from './lib/supabase'
import { useVarillas } from './lib/useVarillas'
import { useSesion } from './lib/useSesion'
import FichaZapataCorrida from './componentes/FichaZapataCorrida'
import Proyectos from './componentes/Proyectos'
import CatalogoPantalla from './componentes/CatalogoPantalla'
import Metodos from './componentes/Metodos'
import Layout from './componentes/Layout'
import Login from './componentes/Login'
import { Boton, Chip } from './componentes/ui'

function estadoConexion({ cargando, error, datos }) {
  if (!supabaseConfigurado) return { color: '#D69E2E', texto: 'Falta configurar Supabase en .env.local' }
  if (cargando) return { color: 'var(--cc-tenue)', texto: 'Conectando…' }
  if (error) return { color: '#f87171', texto: `Error: ${error.message}` }
  return { color: '#34d399', texto: `Conectado · ${datos.length} varillas` }
}

function TablaVarillas({ datos }) {
  return (
    <section className="max-w-3xl">
      <h2 className="mb-4 text-xl font-bold">Tabla de varillas</h2>
      <div className="overflow-x-auto rounded-2xl" style={{ background: 'var(--cc-superficie)', boxShadow: '6px 6px 12px var(--cc-sombra), -5px -5px 10px var(--cc-luz)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-cc-tenue" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px' }}>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Diámetro</th>
              <th className="px-4 py-3 text-right">mm</th>
              <th className="px-4 py-3 text-right">kg/m</th>
              <th className="px-4 py-3">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((v) => (
              <tr key={v.id} className="border-t border-cc-borde">
                <td className="num px-4 py-2">#{v.id}</td>
                <td className="px-4 py-2">{v.diametro_pulg}</td>
                <td className="num px-4 py-2 text-right">{Number(v.diametro_mm).toFixed(1)}</td>
                <td className="num px-4 py-2 text-right">{Number(v.kg_m).toFixed(3)}</td>
                <td className="px-4 py-2">{v.confirmado ? <Chip color="verde">confirmado</Chip> : <Chip color="ambar">{v.fuente}</Chip>}</td>
              </tr>
            ))}
            {!datos.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-cc-suave">Sin datos todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function App() {
  const varillas = useVarillas()
  const { sesion, perfil, cargando } = useSesion()
  const [vista, setVista] = useState('proyectos')

  if (cargando) return null
  if (supabaseConfigurado && !sesion) return <Login />

  return (
    <Layout vista={vista} onVista={setVista} sesion={sesion} perfil={perfil} conexion={estadoConexion(varillas)}>
      {vista === 'proyectos' && <Proyectos perfil={perfil} onAbrirZapata={() => setVista('ficha-zc')} />}
      {vista === 'catalogo' && <CatalogoPantalla perfil={perfil} />}
      {vista === 'metodos' && <Metodos onAbrirZapata={() => setVista('ficha-zc')} />}
      {vista === 'ficha-zc' && (
        <div className="grid gap-4">
          <div>
            <Boton onClick={() => setVista('metodos')}>← Métodos de análisis</Boton>
          </div>
          <FichaZapataCorrida varillas={varillas.datos} perfil={perfil} />
        </div>
      )}
      {vista === 'varillas' && <TablaVarillas datos={varillas.datos} />}
    </Layout>
  )
}
