export function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Formato corto para listados: "12 sep" o "hoy". */
export function fechaCorta(iso: string | null) {
  if (!iso) return '—'
  const hoy = new Date()
  const local = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  if (iso === local) return 'hoy'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  })
}

export function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
