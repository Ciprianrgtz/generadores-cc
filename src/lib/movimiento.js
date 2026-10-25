// Guarda la posición del cursor sobre lo que se puede tocar, para que el
// reflejo de luz de index.css lo siga. Un solo escuchador para toda la app.
export function activarReflejo() {
  let cuadro = 0
  document.addEventListener('pointermove', (e) => {
    if (cuadro) return
    cuadro = requestAnimationFrame(() => {
      cuadro = 0
      const el = e.target instanceof Element ? e.target.closest('button, a, [style*="cursor: pointer"]') : null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  }, { passive: true })
}
