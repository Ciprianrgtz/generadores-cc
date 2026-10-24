import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Sesión de Supabase Auth + perfil (nombre y rol) del usuario. */
export function useSesion() {
  const [sesion, setSesion] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setSesion(null)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = sesion?.user?.id
  useEffect(() => {
    if (!uid) {
      setPerfil(null)
      return
    }
    supabase
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => setPerfil(data))
  }, [uid])

  return { sesion, perfil, cargando: sesion === undefined }
}

export const salir = () => supabase?.auth.signOut()
