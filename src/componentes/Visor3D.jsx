import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { fmt } from '../dominio/redondeo'
import { Tarjeta, Seccion } from './ui'

/**
 * Visor 3D ligero del proyecto: se arma con lo que ya se analizó.
 * Hoy muestra el terreno (polígono en metros). Cada concepto que se analice
 * agregará su geometría aquí (cimentación, muros, losa…), de modo que el modelo
 * va creciendo en tiempo real a medida que avanzan los generadores.
 * Colores planos y sin texturas, para que sea ligero.
 */
export default function Visor3D({ terreno, altura = 320 }) {
  const caja = useRef(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const escena = new THREE.Scene()
    const render = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    render.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(render.domElement)
    render.domElement.style.display = 'block'

    const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    const controles = new OrbitControls(camara, render.domElement)
    controles.enableDamping = true

    escena.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sol = new THREE.DirectionalLight(0xffffff, 1.1)
    sol.position.set(30, 60, 20)
    escena.add(sol)

    const v = terreno?.vertices
    let centro = new THREE.Vector3(0, 0, 0)
    let tam = 20
    if (v?.length >= 3) {
      // plano (x, y) → escena (x, arriba, −y)
      const forma = new THREE.Shape(v.map(([x, y]) => new THREE.Vector2(x, y)))
      const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      const placa = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1d9e75, transparent: true, opacity: 0.55 }))
      escena.add(placa)
      escena.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x3ddba6 })))

      const caja3 = new THREE.Box3().setFromObject(placa)
      caja3.getCenter(centro)
      const dim = caja3.getSize(new THREE.Vector3())
      tam = Math.max(dim.x, dim.z, 4)
      const rejilla = new THREE.GridHelper(Math.ceil((tam * 1.8) / 5) * 5, Math.ceil((tam * 1.8) / 5), 0x4b5a55, 0x2a3431)
      rejilla.position.set(centro.x, -0.01, centro.z)
      escena.add(rejilla)
    } else {
      escena.add(new THREE.GridHelper(20, 20, 0x4b5a55, 0x2a3431))
    }
    camara.position.set(centro.x + tam * 0.9, tam * 0.8, centro.z + tam * 1.2)
    controles.target.copy(centro)
    controles.update()

    const ajustar = () => {
      const w = el.clientWidth || 600
      render.setSize(w, altura)
      camara.aspect = w / altura
      camara.updateProjectionMatrix()
    }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)

    let cuadro = 0
    const animar = () => {
      cuadro = requestAnimationFrame(animar)
      controles.update()
      render.render(escena, camara)
    }
    animar()

    return () => {
      cancelAnimationFrame(cuadro)
      obs.disconnect()
      controles.dispose()
      escena.traverse((o) => {
        o.geometry?.dispose?.()
        if (o.material) [].concat(o.material).forEach((m) => m.dispose())
      })
      render.dispose()
      el.removeChild(render.domElement)
    }
  }, [terreno, altura])

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
        <Seccion>Modelo 3D · se arma con lo que vas analizando</Seccion>
        {terreno?.area > 0 && (
          <span className="num ml-auto text-xs text-cc-suave">
            Terreno {fmt(terreno.area)} m² · perímetro {fmt(terreno.perimetro)} m
          </span>
        )}
      </div>
      <div className="relative">
        <div ref={caja} style={{ height: altura, cursor: 'grab' }} />
        {!terreno?.vertices?.length && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-cc-suave">
            Aún no hay nada analizado. Empieza por el terreno (limpia y despalme) y aquí aparece.
          </p>
        )}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-cc-tenue">Arrastra para girar · rueda para acercar</p>
      </div>
    </Tarjeta>
  )
}
