import { api } from '../api/client'
import type { Usuario } from '../types'

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

const CLAVE_USUARIO = 'sm-usuario'

function usuarioGuardado(): Usuario | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_USUARIO)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

/**
 * La firma vive en el perfil del usuario (DynamoDB) y viaja en la respuesta
 * del login: se define una vez y no se vuelve a pedir en cada sesión.
 */
export function getFirma(): Firma | null {
  const f = usuarioGuardado()?.firma
  if (!f?.nombre || (f.estilo !== 'clasica' && f.estilo !== 'moderna')) return null
  return { nombre: f.nombre, estilo: f.estilo as EstiloFirma, cargo: f.cargo }
}

/**
 * Guarda la firma en el perfil del usuario.
 *
 * Actualiza también la copia local de la sesión, para que la interfaz la
 * refleje sin esperar una recarga.
 */
export async function setFirma(firma: Firma): Promise<void> {
  const actualizado = await api.usuarios.guardarFirma(firma)
  sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(actualizado))
}
