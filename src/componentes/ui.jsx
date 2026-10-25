import { avisoStyle, botonIconoStyle, botones, cardStyle, chipStyle, colores, inputStyle, microEtiqueta } from '../lib/ui'

// Componentes base del estilo de cristal. Cada uno emite el mismo `style` en línea
// que usa Concepto Cero, porque estilo.css reconoce el vidrio por ese contenido.

export function Tarjeta({ className = '', style, children, ...resto }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{ ...cardStyle, ...style }} {...resto}>
      {children}
    </div>
  )
}

/** variante: 'sec' (por omisión) · 'pri' · 'rojo' · 'ambar'. `chico` para botones de barras y partidas. */
export function Boton({ variante = 'sec', chico = false, className = '', style, disabled, children, ...resto }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      style={{
        ...botones[variante],
        ...(chico ? { padding: '4px 10px', fontSize: 12, borderRadius: 10 } : null),
        ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : null),
        ...style,
      }}
      {...resto}
    >
      {children}
    </button>
  )
}

/** Botón cuadrado para flechas, lápiz y cerrar. `peligro` lo pinta en rojo. */
export function BotonIcono({ peligro = false, disabled, style, children, ...resto }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...botonIconoStyle,
        ...(peligro ? { color: '#E53E3E' } : null),
        ...(disabled ? { opacity: 0.35, cursor: 'not-allowed' } : null),
        ...style,
      }}
      {...resto}
    >
      {children}
    </button>
  )
}

export const Entrada = ({ style, ...resto }) => <input style={{ ...inputStyle, ...style }} {...resto} />
export const Seleccion = ({ style, children, ...resto }) => (
  <select style={{ ...inputStyle, ...style }} {...resto}>{children}</select>
)
export const AreaTexto = ({ style, ...resto }) => <textarea style={{ ...inputStyle, ...style }} {...resto} />

/** Etiqueta pequeña encima de un campo. */
export function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`grid gap-1 ${className}`} style={{ fontSize: 11, color: 'var(--cc-suave)', fontWeight: 500 }}>
      {etiqueta}
      {children}
    </label>
  )
}

/** Tarjeta de aviso: color = 'verde' | 'rojo' | 'ambar' | 'azul'. */
export function Aviso({ color = 'ambar', className = '', children }) {
  return (
    <p className={className} style={{ ...avisoStyle(color), color: colores[color].tono }}>
      {children}
    </p>
  )
}

/** Pastilla de estado. */
export const Chip = ({ color = 'gris', children, style }) => <span style={{ ...chipStyle(color), ...style }}>{children}</span>

/** Micro-etiqueta de sección (mayúsculas, 10 px). */
export const Seccion = ({ children, style }) => <p style={{ ...microEtiqueta, ...style }}>{children}</p>

/** Segmentos: el activo en acento y blanco; los demás hundidos. */
export function Segmentos({ opciones, valor, onCambio }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map(([id, nombre]) => (
        <button
          key={id}
          type="button"
          aria-pressed={valor === id}
          onClick={() => onCambio(id)}
          style={
            valor === id
              ? { background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 600, boxShadow: '3px 3px 8px var(--cc-sombra), -2px -2px 6px var(--cc-luz)' }
              : { background: 'var(--cc-superficie)', color: 'var(--cc-suave)', border: 'none', borderRadius: 10, padding: '5px 12px', fontSize: 12, fontWeight: 600, boxShadow: 'inset 3px 3px 6px var(--cc-sombra), inset -3px -3px 6px var(--cc-luz)' }
          }
        >
          {nombre}
        </button>
      ))}
    </div>
  )
}
