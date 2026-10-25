// Estilos del sistema (idénticos a los de Concepto Cero, ver docs del kit de estilo).
// El aspecto de cristal NO sale de clases: estilo.css reconoce estos estilos en línea
// por su contenido. Una tarjeta o botón de vidrio lleva `var(--cc-sombra)` en su
// boxShadow; un campo hundido, además, la palabra `inset`. Por eso se repiten tal cual.

export const cardStyle = {
  background: 'var(--cc-superficie)',
  boxShadow: '6px 6px 12px var(--cc-sombra), -5px -5px 10px var(--cc-luz)',
}

export const inputStyle = {
  background: 'var(--cc-superficie)',
  boxShadow: 'inset 3px 3px 6px var(--cc-sombra), inset -3px -3px 6px var(--cc-luz)',
  border: 'none',
  outline: 'none',
  color: 'var(--cc-texto)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  width: '100%',
}

const relieve = '3px 3px 8px var(--cc-sombra), -2px -2px 6px var(--cc-luz)'

const botonBase = {
  border: 'none',
  borderRadius: 12,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: relieve,
}

export const botones = {
  // secundario: vidrio con texto suave
  sec: { ...botonBase, background: 'var(--cc-superficie)', color: 'var(--cc-suave)' },
  // primario: acento sólido
  pri: { ...botonBase, background: '#1D9E75', color: '#fff' },
  // destructivo
  rojo: { ...botonBase, background: '#E53E3E', color: '#fff' },
  // aviso
  ambar: { ...botonBase, background: '#D69E2E', color: '#fff' },
}

// Colores semánticos del sistema: [rgb para fondos/bordes translúcidos, tono de texto para fondo oscuro].
// Los tonos de texto son los mismos que `estilo.css` devuelve a versiones firmes al imprimir.
export const colores = {
  verde: { rgb: '29,158,117', tono: '#34d399', solido: '#1D9E75' },
  azul: { rgb: '49,130,206', tono: '#63b3ed', solido: '#3182CE' },
  ambar: { rgb: '214,158,46', tono: '#f0b866', solido: '#D69E2E' },
  rojo: { rgb: '229,62,62', tono: '#f87171', solido: '#E53E3E' },
  violeta: { rgb: '159,122,234', tono: '#b794f4', solido: '#9F7AEA' },
  gris: { rgb: '160,174,192', tono: 'var(--cc-suave)', solido: '#718096' },
}

/** Tarjeta de aviso: fondo rgba(color,.06) + borde rgba(color,.25). */
export const avisoStyle = (color) => ({
  background: `rgba(${colores[color].rgb},0.06)`,
  border: `1px solid rgba(${colores[color].rgb},0.25)`,
  borderRadius: 12,
  padding: '8px 12px',
  fontSize: 13,
})

/** Etiqueta de estado (pastilla). */
export const chipStyle = (color) => ({
  background: `rgba(${colores[color].rgb},0.16)`,
  color: colores[color].tono,
  border: `1px solid rgba(${colores[color].rgb},0.35)`,
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.4px',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
})

/** Botón cuadrado de icono/flecha (como los de abajo del menú lateral). */
export const botonIconoStyle = {
  width: 28,
  height: 28,
  borderRadius: 9,
  background: 'var(--cc-superficie)',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '3px 3px 6px var(--cc-sombra), -3px -3px 6px var(--cc-luz)',
  color: 'var(--cc-suave)',
  fontSize: 11,
}

/** Micro-etiqueta de sección: mayúsculas de 10 px. */
export const microEtiqueta = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--cc-tenue)',
  textTransform: 'uppercase',
  letterSpacing: '.6px',
}
