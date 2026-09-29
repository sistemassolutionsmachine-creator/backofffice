import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { TokenPayload, Usuario } from '../types.js'

/**
 * JWT (HS256) y hash de PIN implementados con `node:crypto`.
 * Sin librerías externas: menos peso en el bundle y arranques en frío más
 * rápidos, que es lo que se factura en Lambda.
 */

const SECRETO = process.env.JWT_SECRET ?? 'dev-secret-no-usar-en-produccion'
const DURACION_HORAS = 12

const b64url = (b: Buffer) => b.toString('base64url')

function firmar(data: string) {
  return b64url(createHmac('sha256', SECRETO).update(data).digest())
}

export function crearToken(u: Usuario): string {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload: TokenPayload = {
    sub: u.id,
    usuario: u.usuario,
    rol: u.rol,
    empresaId: u.empresaId,
    exp: Math.floor(Date.now() / 1000) + DURACION_HORAS * 3600,
  }
  const cuerpo = b64url(Buffer.from(JSON.stringify(payload)))
  const base = `${header}.${cuerpo}`
  return `${base}.${firmar(base)}`
}

export function verificarToken(token: string): TokenPayload | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null

  const base = `${partes[0]}.${partes[1]}`
  const esperada = Buffer.from(firmar(base))
  const recibida = Buffer.from(partes[2])
  if (esperada.length !== recibida.length) return null
  if (!timingSafeEqual(esperada, recibida)) return null

  try {
    const payload = JSON.parse(
      Buffer.from(partes[1], 'base64url').toString(),
    ) as TokenPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/* ---------- PIN ---------- */

export function hashPin(pin: string): string {
  const sal = randomBytes(16)
  const hash = scryptSync(pin, sal, 32)
  return `${sal.toString('hex')}:${hash.toString('hex')}`
}

export function verificarPin(pin: string, almacenado: string): boolean {
  const [salHex, hashHex] = almacenado.split(':')
  if (!salHex || !hashHex) return false
  const hash = scryptSync(pin, Buffer.from(salHex, 'hex'), 32)
  const esperado = Buffer.from(hashHex, 'hex')
  if (hash.length !== esperado.length) return false
  return timingSafeEqual(hash, esperado)
}
