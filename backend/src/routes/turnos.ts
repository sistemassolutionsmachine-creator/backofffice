import { get, k, limpiar, nuevoId, put, query, update } from '../lib/dynamo.js'
import {
  creado,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  prohibido,
  type Peticion,
} from '../lib/http.js'
import type { Turno } from '../types.js'

/**
 * Turnos de trabajo del técnico.
 *
 * El turno agrupa los borradores y reportes de una jornada. Cerrarlo no borra
 * nada: los borradores siguen disponibles para retomarlos después.
 */

/** Turnos de un técnico, del más reciente al más antiguo. */
async function turnosDe(tecnicoId: string, limite?: number) {
  return query<Turno>({
    index: 'GSI1',
    pk: `USUARIO#${tecnicoId}`,
    sk: 'TURNO#',
    ascendente: false,
    limite,
  })
}

export async function turnoActivoDe(tecnicoId: string): Promise<Turno | null> {
  // El turno abierto siempre es el más reciente: nunca hay dos a la vez.
  const [ultimo] = await turnosDe(tecnicoId, 1)
  return ultimo && !ultimo.fin ? ultimo : null
}

export async function iniciar(req: Peticion) {
  const auth = exigir(req, 'tecnico')

  const abierto = await turnoActivoDe(auth.sub)
  if (abierto) throw malaPeticion('Ya tiene un turno activo. Finalícelo antes de iniciar otro.')

  const turno: Turno = {
    id: nuevoId('tn'),
    tecnicoId: auth.sub,
    tecnico: auth.usuario,
    inicio: new Date().toISOString(),
    fin: null,
  }

  await put({
    ...k.turno(turno.id),
    GSI1PK: `USUARIO#${turno.tecnicoId}`,
    GSI1SK: `TURNO#${turno.inicio}#${turno.id}`,
    GSI2PK: 'T#TURNO',
    GSI2SK: `${turno.inicio}#${turno.id}`,
    ...turno,
  })

  return creado(turno)
}

/** El técnico consulta su turno abierto al entrar a la aplicación. */
export async function activo(req: Peticion) {
  const auth = exigir(req, 'tecnico')
  const turno = await turnoActivoDe(auth.sub)
  return ok(turno ? limpiar(turno) : null)
}

export async function cerrar(req: Peticion, id: string) {
  const auth = exigir(req, 'tecnico', 'admin')
  const turno = await get<Turno>(k.turno(id))
  if (!turno) throw noEncontrado('Turno no encontrado')
  if (auth.rol !== 'admin' && turno.tecnicoId !== auth.sub) throw prohibido()
  if (turno.fin) throw malaPeticion('Este turno ya fue finalizado')

  const fin = new Date().toISOString()
  await update(k.turno(id), { fin })
  return ok(limpiar({ ...turno, fin }))
}

/** Historial de turnos: el administrador ve todos, el técnico los suyos. */
export async function listar(req: Peticion) {
  const auth = exigir(req, 'tecnico', 'admin')
  const limite = Math.min(Number(req.query.limite ?? 50), 200)

  if (auth.rol === 'tecnico') {
    return ok((await turnosDe(auth.sub, limite)).map(limpiar))
  }

  if (req.query.tecnico) {
    return ok((await turnosDe(req.query.tecnico, limite)).map(limpiar))
  }

  const turnos = await query<Turno>({
    index: 'GSI2',
    pk: 'T#TURNO',
    ascendente: false,
    limite,
  })
  return ok(turnos.map(limpiar))
}
