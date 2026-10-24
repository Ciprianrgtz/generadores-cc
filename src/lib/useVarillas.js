import { useEffect, useState } from 'react'
import { supabase, supabaseConfigurado } from './supabase'

export function useVarillas() {
  const [estado, setEstado] = useState({ cargando: supabaseConfigurado, error: null, datos: [] })

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('varillas')
      .select('id, diametro_pulg, diametro_mm, kg_m, fuente, confirmado')
      .order('orden')
      .then(({ data, error }) => setEstado({ cargando: false, error, datos: data ?? [] }))
  }, [])

  return estado
}

/** { '3': { kg_m: 0.557, … }, … } para los cálculos */
export const varillasPorId = (lista) =>
  Object.fromEntries(lista.map((v) => [v.id, { ...v, kg_m: Number(v.kg_m) }]))
