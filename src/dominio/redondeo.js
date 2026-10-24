// Redondeo a 2 decimales solo al presentar o al cerrar una cantidad;
// los pasos intermedios se calculan sin redondear (CLAUDE.md §3.6).
export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export const fmt = (n, dec = 2) =>
  Number(n).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// Datos de entrada (medidas, criterios): se muestran tal cual se capturaron, sin redondear.
export const dato = (n) =>
  Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
