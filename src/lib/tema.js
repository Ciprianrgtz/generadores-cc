import { useLayoutEffect } from 'react'

// Las pantallas que deben verse claras (portal del cliente, cámara, páginas de
// impresión) quitan el tema oscuro mientras están abiertas.
export function useTemaClaro() {
  useLayoutEffect(() => {
    const raiz = document.documentElement
    const estaba = raiz.classList.contains('cc-oscuro')
    raiz.classList.remove('cc-oscuro')
    return () => { if (estaba) raiz.classList.add('cc-oscuro') }
  }, [])
}
