export type EstiloFirma = 'clasica' | 'moderna'

export interface Firma {
  nombre: string
  estilo: EstiloFirma
  /** Solo se usa en la firma de recepción del cliente. */
  cargo?: string
}

export const ESTILOS_FIRMA: Record<
  EstiloFirma,
  { label: string; descripcion: string; font: string }
> = {
  clasica: {
    label: 'Clásica',
    descripcion: 'Caligrafía elegante',
    font: '"Great Vibes", cursive',
  },
  moderna: {
    label: 'Moderna',
    descripcion: 'Trazo manuscrito',
    font: '"Caveat", cursive',
  },
}

const KEY = 'sm-firma'

export function getFirma(): Firma | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const f = JSON.parse(raw) as Firma
    if (!f.nombre || !(f.estilo in ESTILOS_FIRMA)) return null
    return f
  } catch {
    return null
  }
}

export function setFirma(firma: Firma) {
  sessionStorage.setItem(KEY, JSON.stringify(firma))
}
