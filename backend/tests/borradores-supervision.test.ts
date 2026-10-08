import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { ddb, k } from '../src/lib/dynamo.js'
import { s3 } from '../src/lib/s3.js'
import type { Peticion } from '../src/lib/http.js'
import {
  actualizar,
  crear,
  eliminarBorrador,
  firmarCliente,
  listar,
  supervisar,
} from '../src/routes/revisiones.js'
import { activo, cerrar, iniciar, listar as listarTurnos } from '../src/routes/turnos.js'

/* Única frontera simulada: los transportes de DynamoDB y S3. */
const registros = new Map<string, Record<string, any>>()
const clave = (v: Record<string, any>) => `${v.PK}|${v.SK}`
const insertar = (v: Record<string, any>) => registros.set(clave(v), structuredClone(v))
const borradasS3: string[][] = []

mock.method(s3, 'send', async (cmd: any) => {
  if (cmd.constructor.name === 'DeleteObjectsCommand') {
    borradasS3.push(cmd.input.Delete.Objects.map((o: any) => o.Key))
    return {}
  }
  throw new Error(`Comando S3 no simulado: ${cmd.constructor.name}`)
})

mock.method(ddb, 'send', async (cmd: any) => {
  const p = cmd.input
  switch (cmd.constructor.name) {
    case 'GetCommand':
      return { Item: structuredClone(registros.get(clave(p.Key))) }
    case 'PutCommand':
      insertar(p.Item)
      return {}
    case 'DeleteCommand':
      registros.delete(clave(p.Key))
      return {}
    case 'UpdateCommand': {
      if (p.UpdateExpression.startsWith('ADD')) {
        const contador = registros.get(clave(p.Key)) ?? { ...p.Key, valor: 0 }
        contador.valor += 1
        registros.set(clave(p.Key), contador)
        return { Attributes: { valor: contador.valor } }
      }
      const item = { ...registros.get(clave(p.Key)) }
      for (const [alias, campo] of Object.entries(p.ExpressionAttributeNames)) {
        if (alias.startsWith('#c')) {
          item[campo as string] = p.ExpressionAttributeValues[alias.replace('#c', ':v')]
        }
      }
      insertar({ ...p.Key, ...item })
      return { Attributes: structuredClone(item) }
    }
    case 'QueryCommand': {
      const v = p.ExpressionAttributeValues
      const pkCampo = p.IndexName ? `${p.IndexName}PK` : 'PK'
      const skCampo = p.IndexName ? `${p.IndexName}SK` : 'SK'
      const exacto = p.KeyConditionExpression.includes('#sk = :sk')
      let items = [...registros.values()].filter((r) => {
        if (r[pkCampo] !== v[':pk']) return false
        if (!v[':sk']) return true
        const sk = String(r[skCampo] ?? '')
        return exacto ? sk === v[':sk'] : sk.startsWith(v[':sk'])
      })
      items.sort((a, b) => String(a[skCampo]).localeCompare(String(b[skCampo])))
      if (p.ScanIndexForward === false) items.reverse()
      if (p.Limit) items = items.slice(0, p.Limit)
      return { Items: structuredClone(items) }
    }
    default:
      throw new Error(`Comando no simulado: ${cmd.constructor.name}`)
  }
})

const req = (
  body: unknown,
  rol: 'tecnico' | 'admin' | 'cliente' = 'tecnico',
  extra: Partial<Peticion['auth'] & object> = {},
): Peticion => ({
  metodo: 'POST',
  ruta: '/',
  segmentos: [],
  query: {},
  body,
  auth: {
    sub: rol === 'tecnico' ? 'us-tec' : rol === 'admin' ? 'us-adm' : 'us-cli',
    usuario: rol,
    rol,
    ...(rol === 'cliente' ? { empresaId: 'em-1' } : {}),
    exp: 9999999999,
    ...extra,
  } as Peticion['auth'],
})

const conQuery = (p: Peticion, query: Record<string, string>) => ({ ...p, query })
const cuerpoDe = (r: { body: string }) => JSON.parse(r.body)

beforeEach(() => {
  registros.clear()
  borradasS3.length = 0
  insertar({
    ...k.equipo('eq-1'),
    id: 'eq-1',
    empresaId: 'em-1',
    estado: 'operativo',
    ultimaRevision: null,
  })
})

async function crearBorrador(extra: Record<string, unknown> = {}) {
  return cuerpoDe(
    await crear(
      req({
        equipoId: 'eq-1',
        estado: 'borrador',
        fecha: '2026-10-08',
        borradorDatos: { motivo: 'preventivo', avance: 1 },
        ...extra,
      }),
    ),
  )
}

async function completar(id: string, quien: Peticion = req({})) {
  return cuerpoDe(
    await actualizar(
      { ...quien, body: { estado: 'completado', estadoEquipo: 'operativo' } },
      'eq-1',
      id,
    ),
  )
}

test('el borrador no consume consecutivo y lo toma al registrarse', async () => {
  const borrador = await crearBorrador()
  assert.equal(borrador.consecutivo, '')
  assert.equal(borrador.estado, 'borrador')

  const registrado = await completar(borrador.id)
  assert.match(registrado.consecutivo, /^SM-\d{4}-00001$/)

  // El siguiente reporte continúa la numeración.
  const directo = cuerpoDe(await crear(req({ equipoId: 'eq-1', estado: 'en_proceso' })))
  assert.match(directo.consecutivo, /00002$/)
})

test('el técnico recupera sus borradores y el administrador los de todos', async () => {
  const borrador = await crearBorrador()

  const propios = cuerpoDe(await listar(conQuery(req(null), { borradores: '1' })))
  assert.deepEqual(propios.map((r: any) => r.id), [borrador.id])

  const deAdmin = cuerpoDe(await listar(conQuery(req(null, 'admin'), { borradores: '1' })))
  assert.deepEqual(deAdmin.map((r: any) => r.id), [borrador.id])

  const otroTecnico = req(null, 'tecnico', { sub: 'us-otro', usuario: 'otro' })
  const ajenos = cuerpoDe(await listar(conQuery(otroTecnico, { borradores: '1' })))
  assert.equal(ajenos.length, 0)

  // Y tampoco puede editar un borrador ajeno.
  await assert.rejects(
    actualizar({ ...otroTecnico, body: { monitoreo: 'x' } }, 'eq-1', borrador.id),
    { statusCode: 403 },
  )
})

test('al registrarse, el borrador sale del catálogo y entra al historial', async () => {
  const borrador = await crearBorrador()
  await completar(borrador.id)

  const pendientes = cuerpoDe(await listar(conQuery(req(null), { borradores: '1' })))
  assert.equal(pendientes.length, 0)

  const historial = cuerpoDe(await listar(req(null, 'admin')))
  assert.deepEqual(historial.map((r: any) => r.id), [borrador.id])

  await assert.rejects(
    actualizar(req({ estado: 'borrador' }), 'eq-1', borrador.id),
    { statusCode: 400, message: /no puede volver a ser borrador/ },
  )
})

test('eliminar borradores: solo el dueño o el admin, nunca reportes registrados', async () => {
  const borrador = await crearBorrador({ fotosEntrada: ['evidencias/a.jpg'] })

  const otro = req(null, 'tecnico', { sub: 'us-otro', usuario: 'otro' })
  await assert.rejects(eliminarBorrador(otro, 'eq-1', borrador.id), { statusCode: 403 })

  await eliminarBorrador(req(null), 'eq-1', borrador.id)
  assert.deepEqual(borradasS3, [['evidencias/a.jpg']])

  const registrado = cuerpoDe(await crear(req({ equipoId: 'eq-1', estado: 'en_proceso' })))
  await assert.rejects(eliminarBorrador(req(null, 'admin'), 'eq-1', registrado.id), {
    statusCode: 400,
    message: /Solo se pueden eliminar borradores/,
  })
})

test('el cliente solo ve reportes con supervisión terminada y solo entonces firma', async () => {
  const borrador = await crearBorrador()
  const registrado = await completar(borrador.id)

  const firma = { nombre: 'Rep. Cliente', cargo: 'Jefe', estilo: 'clasica' }
  const comoCliente = cuerpoDe(await listar(req(null, 'cliente')))
  assert.equal(comoCliente.length, 0)
  await assert.rejects(
    firmarCliente(req(firma, 'cliente'), 'eq-1', registrado.id),
    { statusCode: 400, message: /pendiente de supervisión/ },
  )

  await assert.rejects(supervisar(req(null), 'eq-1', registrado.id), { statusCode: 403 })
  const supervisado = cuerpoDe(await supervisar(req(null, 'admin'), 'eq-1', registrado.id))
  assert.equal(supervisado.supervision.por, 'admin')

  const visibles = cuerpoDe(await listar(req(null, 'cliente')))
  assert.deepEqual(visibles.map((r: any) => r.id), [registrado.id])

  const firmado = cuerpoDe(await firmarCliente(req(firma, 'cliente'), 'eq-1', registrado.id))
  assert.equal(firmado.firmaCliente.nombre, 'Rep. Cliente')

  // Con la firma del cliente se cierra la edición, incluso para el admin.
  await assert.rejects(
    actualizar(req({ monitoreo: 'x' }, 'admin'), 'eq-1', registrado.id),
    { statusCode: 400, message: /firmado por el cliente/ },
  )
})

test('la supervisión exige reporte completado y los antiguos siguen visibles', async () => {
  const borrador = await crearBorrador()
  await assert.rejects(supervisar(req(null, 'admin'), 'eq-1', borrador.id), {
    statusCode: 400,
    message: /reporte completado/,
  })

  // Reporte anterior a la supervisión: sin el campo `requiereSupervision`.
  insertar({
    ...k.revision('eq-1', '2026-09-01', 'rv-legado'),
    GSI1PK: 'EMPRESA#em-1',
    GSI1SK: 'REVISION#2026-09-01#rv-legado',
    GSI2PK: 'T#REVISION',
    GSI2SK: '2026-09-01#rv-legado',
    id: 'rv-legado',
    consecutivo: 'SM-2026-00099',
    equipoId: 'eq-1',
    empresaId: 'em-1',
    estado: 'completado',
    fotosEntrada: [],
    fotosSalida: [],
    firmaCliente: null,
  })
  const visibles = cuerpoDe(await listar(req(null, 'cliente')))
  assert.deepEqual(visibles.map((r: any) => r.id), ['rv-legado'])
})

test('turnos: único activo, cierre propio y borradores ligados al turno', async () => {
  const turno = cuerpoDe(await iniciar(req(null)))
  assert.equal(turno.fin, null)
  await assert.rejects(iniciar(req(null)), { statusCode: 400, message: /turno activo/ })

  const abierto = cuerpoDe(await activo(req(null)))
  assert.equal(abierto.id, turno.id)

  const borrador = await crearBorrador()
  assert.equal(borrador.turnoId, turno.id)

  const otro = req(null, 'tecnico', { sub: 'us-otro', usuario: 'otro' })
  await assert.rejects(cerrar(otro, turno.id), { statusCode: 403 })

  const cerrado = cuerpoDe(await cerrar(req(null), turno.id))
  assert.ok(cerrado.fin)
  assert.equal(cuerpoDe(await activo(req(null))), null)

  // El borrador sobrevive al cierre del turno.
  const pendientes = cuerpoDe(await listar(conQuery(req(null), { borradores: '1' })))
  assert.deepEqual(pendientes.map((r: any) => r.id), [borrador.id])

  // El administrador consulta los turnos de un técnico.
  const historial = cuerpoDe(await listarTurnos(conQuery(req(null, 'admin'), { tecnico: 'us-tec' })))
  assert.deepEqual(historial.map((t: any) => t.id), [turno.id])
})
