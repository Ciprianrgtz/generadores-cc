import { useState } from 'react'
import { Boton, Campo, Entrada, AreaTexto, Seccion, Tarjeta } from './ui'
import { avisoStyle } from '../lib/ui'

// Formularios en línea que usan el paquete y el catálogo (todo lo que se escribe es editable).
export function FormularioNombre({ inicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(inicial)
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (nombre.trim()) onGuardar(nombre.trim())
      }}
    >
      <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: 256 }} />
      <Boton type="submit" variante="pri" disabled={!nombre.trim()}>Guardar</Boton>
      <Boton onClick={onCancelar}>Cancelar</Boton>
    </form>
  )
}

/** Borrar un paquete completo no se puede deshacer: hay que escribir su nombre. */
export function FormularioEliminar({ nombre, conceptos, onEliminar, onCancelar }) {
  const [texto, setTexto] = useState('')
  const coincide = texto.trim().toLowerCase() === nombre.trim().toLowerCase()
  return (
    <form
      className="grid gap-3 p-4"
      style={avisoStyle('rojo')}
      onSubmit={(e) => {
        e.preventDefault()
        if (coincide) onEliminar()
      }}
    >
      <p style={{ color: 'var(--cc-texto)' }}>
        Vas a eliminar el paquete <b>{nombre}</b> con sus partidas y <b>{conceptos} conceptos</b>, incluido el avance de cada uno. No se puede deshacer.
        El proyecto y sus zapatas no se borran. Si solo quieres dejarlo a un lado, mejor archívalo.
      </p>
      <Campo etiqueta="Para confirmar, escribe el nombre del paquete" className="max-w-sm">
        <Entrada autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={nombre} />
      </Campo>
      <div className="flex gap-2">
        <Boton type="submit" variante="rojo" disabled={!coincide}>Eliminar definitivamente</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
}

export function FormularioPartida({ titulo, inicial, onGuardar, onCancelar, sinMarco }) {
  const [v, setV] = useState(inicial)
  const valido = v.clave.trim() && v.descripcion.trim()
  const contenido = (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valido) onGuardar(v)
      }}
    >
      <Seccion>{titulo}</Seccion>
      <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
        <Campo etiqueta="Clave">
          <Entrada autoFocus value={v.clave} onChange={(e) => setV({ ...v, clave: e.target.value })} placeholder="PRE" className="num" />
        </Campo>
        <Campo etiqueta="Nombre de la partida">
          <Entrada value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} placeholder="PRELIMINARES" />
        </Campo>
      </div>
      <div className="flex gap-2">
        <Boton type="submit" variante="pri" disabled={!valido}>Guardar</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
  return sinMarco ? (
    <div className="p-3" style={{ background: 'rgba(29,158,117,0.06)', borderRadius: 'inherit' }}>{contenido}</div>
  ) : (
    <Tarjeta className="p-4">{contenido}</Tarjeta>
  )
}

export function FormularioConcepto({ titulo, inicial, onGuardar, onCancelar, guardar = 'Agregar' }) {
  const [v, setV] = useState(inicial)
  const valido = v.clave.trim() && v.descripcion.trim() && v.unidad.trim()
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valido) onGuardar({ ...v, clave: v.clave.trim().toUpperCase(), unidad: v.unidad.trim().toUpperCase(), descripcion: v.descripcion.trim() })
      }}
    >
      <Seccion>{titulo}</Seccion>
      <div className="grid gap-2 sm:grid-cols-[130px_90px]">
        <Campo etiqueta="Clave">
          <Entrada autoFocus value={v.clave} onChange={(e) => setV({ ...v, clave: e.target.value })} placeholder="PRE005" className="num" />
        </Campo>
        <Campo etiqueta="Unidad">
          <Entrada value={v.unidad} onChange={(e) => setV({ ...v, unidad: e.target.value })} placeholder="M2" className="num" />
        </Campo>
      </div>
      <Campo etiqueta="Descripción">
        <AreaTexto value={v.descripcion} onChange={(e) => setV({ ...v, descripcion: e.target.value })} rows={3} />
      </Campo>
      <div className="flex gap-2">
        <Boton type="submit" variante="pri" disabled={!valido}>{guardar}</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </form>
  )
}
