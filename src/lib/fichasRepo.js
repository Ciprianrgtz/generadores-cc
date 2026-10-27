import { supabase } from './supabase'

// Lectura y escritura de fichas. Las reglas del flujo (quién revisa, quién
// aprueba, fichas congeladas) las valida la base de datos; aquí solo se piden.

const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

export async function elementosTipo(proyectoClave, grupo) {
  const proyecto = ok(await supabase.from('proyectos').select('id, nombre').eq('clave', proyectoClave).maybeSingle())
  if (!proyecto) return { proyecto: null, elementos: [] }
  const elementos = ok(
    await supabase
      .from('elementos_tipo')
      .select('id, codigo, descripcion, seccion, armado, fuente')
      .eq('proyecto_id', proyecto.id)
      .eq('grupo', grupo)
      .order('codigo'),
  )
  return { proyecto, elementos }
}

/** Todos los elementos tipo de un proyecto, cada uno con su última versión de ficha (o null). */
export async function fichasDelProyecto(proyectoId) {
  const elementos = ok(
    await supabase
      .from('elementos_tipo')
      .select('id, codigo, grupo, descripcion, seccion, armado, fuente')
      .eq('proyecto_id', proyectoId)
      .order('codigo'),
  )
  if (!elementos.length) return []
  const fichas = ok(
    await supabase
      .from('fichas')
      .select('id, elemento_tipo_id, version, estado, parametros, resultados')
      .in('elemento_tipo_id', elementos.map((e) => e.id))
      .order('version', { ascending: false }),
  )
  return elementos.map((e) => ({ ...e, ficha: fichas.find((f) => f.elemento_tipo_id === e.id) ?? null }))
}

/** Alta de un tipo de elemento (por ejemplo una zapata nueva del estructural) en un proyecto. */
export async function crearElementoTipo(fila) {
  return ok(await supabase.from('elementos_tipo').insert(fila).select().single())
}

export async function versiones(elementoTipoId) {
  return ok(
    await supabase
      .from('fichas')
      .select('*')
      .eq('elemento_tipo_id', elementoTipoId)
      .order('version', { ascending: false }),
  )
}

export async function perfiles() {
  const lista = ok(await supabase.from('perfiles').select('id, nombre, rol'))
  return Object.fromEntries(lista.map((p) => [p.id, p]))
}

const campos = ({ parametros, resultados, pasos, nota }) => ({ parametros, resultados, pasos, nota: nota || null })

export async function crearVersion(elementoTipoId, version, contenido) {
  return ok(
    await supabase
      .from('fichas')
      .insert({ elemento_tipo_id: elementoTipoId, version, unidad_analisis: 'ml', metodo: 'zc-plantilla-v1', ...campos(contenido) })
      .select()
      .single(),
  )
}

export async function guardarBorrador(fichaId, contenido) {
  return ok(await supabase.from('fichas').update(campos(contenido)).eq('id', fichaId).select().single())
}

export async function cambiarEstado(fichaId, estado) {
  return ok(await supabase.from('fichas').update({ estado }).eq('id', fichaId).select().single())
}
