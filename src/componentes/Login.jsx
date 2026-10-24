import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
    setEnviando(false)
  }

  const input =
    'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-acento focus:outline-none'

  return (
    <div className="grid min-h-[70vh] place-items-center p-4">
      <form onSubmit={entrar} className="grid w-full max-w-sm gap-3 rounded-lg border border-slate-300 bg-white p-6">
        <div>
          <h2 className="text-lg font-bold">Iniciar sesión</h2>
          <p className="text-sm text-slate-500">Las cuentas las da de alta el administrador.</p>
        </div>
        <label className="grid gap-1 text-xs text-slate-500">
          Correo
          <input type="email" autoComplete="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} className={input} />
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Contraseña
          <input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} className={input} />
        </label>
        {error && <p className="text-sm text-st-err">{error}</p>}
        <button disabled={enviando} className="rounded bg-acento px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
