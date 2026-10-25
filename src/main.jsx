import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { activarReflejo } from './lib/movimiento'

document.documentElement.classList.add('cc-oscuro') // tema oscuro de cristal por defecto
activarReflejo()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
