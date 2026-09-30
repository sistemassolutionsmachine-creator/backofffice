import { get, put, remove } from './dynamo.js'

/**
 * Freno a la fuerza bruta.
 *
 * Un PIN de cuatro dígitos son solo 10.000 combinaciones: sin este control,
 * un script las prueba todas en minutos. Tras varios fallos seguidos se
 * bloquea ese usuario durante un rato.
 *
 * Los registros llevan TTL, así que DynamoDB los borra solo cuando dejan de
 * ser relevantes y no hay que mantener nada.
 */

const MAX_FALLOS = 5
const BLOQUEO_MINUTOS = 15

interface RegistroIntentos {
  fallos: number
  bloqueadoHasta: number
  expira: number
}

const clave = (usuario: string) => ({
  PK: `INTENTOS#${usuario.toLowerCase()}`,
  SK: 'META',
})

const ahora = () => Math.floor(Date.now() / 1000)

/** Minutos que faltan para poder reintentar, o 0 si no está bloqueado. */
export async function minutosDeBloqueo(usuario: string): Promise<number> {
  const r = await get<RegistroIntentos>(clave(usuario))
  if (!r?.bloqueadoHasta) return 0
  const restante = r.bloqueadoHasta - ahora()
  return restante > 0 ? Math.ceil(restante / 60) : 0
}

/** Suma un fallo y bloquea si se alcanzó el límite. */
export async function registrarFallo(usuario: string) {
  const actual = await get<RegistroIntentos>(clave(usuario))
  const fallos = (actual?.fallos ?? 0) + 1
  const bloquear = fallos >= MAX_FALLOS

  await put({
    ...clave(usuario),
    fallos: bloquear ? 0 : fallos,
    bloqueadoHasta: bloquear ? ahora() + BLOQUEO_MINUTOS * 60 : 0,
    // El registro se descarta solo pasada la ventana de bloqueo.
    expira: ahora() + (BLOQUEO_MINUTOS + 5) * 60,
  })

  return {
    bloqueado: bloquear,
    restantes: Math.max(0, MAX_FALLOS - fallos),
    minutos: BLOQUEO_MINUTOS,
  }
}

/** Un ingreso correcto limpia el historial de fallos. */
export async function limpiarIntentos(usuario: string) {
  await remove(clave(usuario))
}
