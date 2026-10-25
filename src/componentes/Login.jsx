import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { botones, inputStyle } from '../lib/ui'

// Mismo login que el sistema de gestión de obras: tarjeta de cristal de 380 px centrada.
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
    if (error) setError(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas. Verifica tu correo y contraseña.' : error.message)
    setEnviando(false)
  }

  const campo = { ...inputStyle, borderRadius: 12, padding: '12px 16px', fontSize: 14 }
  const etiqueta = { fontSize: 12, color: 'var(--cc-suave)', marginBottom: 6, display: 'block', fontWeight: 500 }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(18px)',
          border: '1px solid var(--cc-borde)',
          borderRadius: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          padding: '40px 36px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo-gris.png" className="cc-logo" alt="Concepto Cero Arquitectura" style={{ height: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          <p style={{ fontSize: 12, color: 'var(--cc-suave)', marginTop: 10, letterSpacing: 1 }}>Sistema de generadores y presupuestos</p>
        </div>

        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={etiqueta}>Correo electrónico</label>
            <input type="email" style={campo} placeholder="correo@empresa.com" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label style={etiqueta}>Contraseña</label>
            <input type="password" style={campo} placeholder="••••••••" value={clave} onChange={(e) => setClave(e.target.value)} required autoComplete="current-password" />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#E53E3E', textAlign: 'center', padding: '8px 12px', background: 'rgba(229,62,62,0.08)', borderRadius: 8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            style={{
              ...botones.pri,
              marginTop: 4,
              padding: 13,
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.5,
              cursor: enviando ? 'not-allowed' : 'pointer',
              ...(enviando ? { background: 'var(--cc-sombra)', boxShadow: 'none' } : { boxShadow: '4px 4px 10px var(--cc-sombra), -3px -3px 8px var(--cc-luz)' }),
              transition: 'all .2s',
            }}
          >
            {enviando ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--cc-tenue)', marginTop: 28 }}>
          Concepto Cero Arquitectura · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
