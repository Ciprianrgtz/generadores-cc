import { useState } from 'react'
import { BookOpen, Boxes, ChevronDown, FolderOpen, LogOut, Menu, Ruler, X } from 'lucide-react'
import { salir } from '../lib/useSesion'

// Menú lateral: mismo diseño que el de Concepto Cero (200 px abierto / 64 px colapsado,
// grupos plegables, activo en verde con anillo). Aquí no hay rutas: se elige una vista.
const AREAS = [
  { id: 'generadores', titulo: 'Generadores', modulos: [{ id: 'proyectos', icon: FolderOpen, label: 'Proyectos' }] },
  { id: 'analisis', titulo: 'Análisis', modulos: [{ id: 'metodos', icon: Ruler, label: 'Métodos de análisis' }] },
  { id: 'catalogos', titulo: 'Catálogos', modulos: [{ id: 'catalogo', icon: BookOpen, label: 'Conceptos' }, { id: 'varillas', icon: Boxes, label: 'Varillas' }] },
]

const ROLES = { lectura: 'Solo lectura', captura: 'Captura', revision: 'Revisión', aprobacion: 'Aprobación' }

const botonCuadrado = {
  width: 32,
  height: 32,
  borderRadius: 9,
  background: 'var(--cc-superficie)',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '3px 3px 6px var(--cc-sombra), -3px -3px 6px var(--cc-luz)',
  color: 'var(--cc-suave)',
}

export default function Layout({ vista, onVista, sesion, perfil, conexion, children }) {
  const [abierto, setAbierto] = useState(true)
  const [cerrados, setCerrados] = useState({})
  const nombre = perfil?.nombre ?? sesion?.user?.email

  return (
    <div className="flex h-screen">
      <aside
        className="flex flex-col py-6 transition-all duration-300 flex-shrink-0"
        style={{ width: abierto ? 200 : 64, background: 'rgba(16,20,19,0.72)', backdropFilter: 'blur(14px)', borderRight: '1px solid var(--cc-borde)' }}
      >
        <div className="flex items-center gap-3 px-4 mb-6">
          <div className="flex-shrink-0" style={{ width: 36, height: 36, overflow: 'hidden', borderRadius: 8 }}>
            <img src="/logo-isotipo.png" alt="Concepto Cero" className="cc-logo" style={{ width: 36, height: 36, objectFit: 'contain', transform: 'scale(1.15)' }} />
          </div>
          {abierto && (
            <span className="min-w-0">
              <span className="block font-bold text-sm truncate" style={{ color: 'var(--cc-texto)' }}>Concepto Cero</span>
              <span className="block truncate" style={{ fontSize: 10, color: 'var(--cc-suave)' }}>Generadores</span>
            </span>
          )}
        </div>

        {abierto && nombre && (
          <div style={{ margin: '0 10px 12px', padding: '8px 10px', borderRadius: 10, background: 'var(--cc-superficie)', boxShadow: 'inset 2px 2px 5px var(--cc-sombra), inset -1px -1px 4px var(--cc-luz)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--cc-texto)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</p>
            {perfil && <p style={{ fontSize: 10, color: '#1D9E75', marginTop: 1 }}>{ROLES[perfil.rol] ?? perfil.rol}</p>}
            {conexion && <p style={{ fontSize: 9, color: conexion.color, marginTop: 1 }}>● {conexion.texto}</p>}
          </div>
        )}

        <nav className="flex flex-col gap-1 px-2" style={{ flex: 1, overflowY: 'auto' }}>
          {AREAS.map((area, i) => {
            const abierta = !abierto || !cerrados[area.id] || area.modulos.some((m) => m.id === vista)
            return (
              <div key={area.id}>
                {abierto ? (
                  <button
                    type="button"
                    aria-expanded={abierta}
                    onClick={() => setCerrados((c) => ({ ...c, [area.id]: abierta }))}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px 4px', marginTop: i === 0 ? 0 : 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--cc-tenue)', textTransform: 'uppercase', letterSpacing: '.6px' }}
                  >
                    <span style={{ flex: 1, textAlign: 'left' }}>{area.titulo}</span>
                    <ChevronDown size={12} aria-hidden="true" style={{ transform: abierta ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                  </button>
                ) : (
                  i > 0 && <div style={{ margin: '6px 8px', borderTop: '1px solid var(--cc-borde)' }} />
                )}
                {abierta &&
                  area.modulos.map((modulo) => {
                    const { id, label } = modulo
                    const Icon = modulo.icon
                    const activo = vista === id || (id === 'metodos' && vista === 'ficha-zc')
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onVista(id)}
                        title={abierto ? undefined : label}
                        aria-current={activo ? 'page' : undefined}
                        className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                        style={{
                          color: activo ? '#3ddba6' : 'var(--cc-suave)',
                          background: activo ? 'rgba(29,158,117,0.14)' : 'transparent',
                          boxShadow: activo ? 'inset 0 0 0 1px rgba(29,158,117,0.35)' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Icon size={18} className="flex-shrink-0" />
                        {abierto && <span className="text-sm font-medium">{label}</span>}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 8 }}>
          <button type="button" onClick={() => setAbierto(!abierto)} title={abierto ? 'Contraer menú' : 'Expandir menú'} style={botonCuadrado}>
            {abierto ? <X size={14} /> : <Menu size={14} />}
          </button>
          <button type="button" onClick={salir} title="Cerrar sesión" style={{ ...botonCuadrado, color: '#E53E3E' }}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <div key={vista} className="cc-entrada">{children}</div>
      </main>
    </div>
  )
}
