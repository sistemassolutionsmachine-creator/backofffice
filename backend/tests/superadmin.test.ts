import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { ddb, k } from '../src/lib/dynamo.js'
import type { Peticion } from '../src/lib/http.js'
import { actualizar, eliminar, reiniciarPin } from '../src/routes/usuarios.js'

// Única frontera simulada: el transporte de DynamoDB.
const registros = new Map<string, Record<string, any>>()
const clave = (v: Record<string, any>) => `${v.PK}|${v.SK}`
const insertar = (v: Record<string, any>) => registros.set(clave(v), structuredClone(v))
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
      const item = { ...registros.get(clave(p.Key)) }
      Object.entries(p.ExpressionAttributeNames).forEach(([alias, campo]) => {
        item[campo as string] = p.ExpressionAttributeValues[alias.replace('#c', ':v')]
      })
      insertar({ ...p.Key, ...item })
      return {}
    }
    case 'QueryCommand': {
      const names = p.ExpressionAttributeNames
      const values = p.ExpressionAttributeValues
      return {
        Items: structuredClone(
          [...registros.values()].filter(
            (r) =>
              r[names['#pk']] === values[':pk'] &&
              (!names['#sk'] || r[names['#sk']] === values[':sk']),
          ),
        ),
      }
    }
    default:
      throw new Error(`Comando no simulado: ${cmd.constructor.name}`)
  }
})

function usuario(id: string, extra: Record<string, unknown> = {}) {
  insertar({
    ...k.usuario(id),
    GSI2PK: 'T#USUARIO',
    GSI2SK: id,
    id,
    usuario: id,
    nombre: `Usuario ${id}`,
    email: '',
    rol: 'admin',
    estado: 'activo',
    ultimoAcceso: null,
    pinHash: 'hash',
    ...extra,
  })
}

const req = (actor: string, body: unknown = {}): Peticion => ({
  metodo: 'PUT',
  ruta: '/',
  segmentos: [],
  query: {},
  body,
  auth: { sub: actor, usuario: actor, rol: 'admin', exp: 9999999999 },
})
const leer = (id: string) => registros.get(clave(k.usuario(id)))!

beforeEach(() => {
  registros.clear()
  usuario('jefe', { superadmin: true })
  usuario('admin')
  usuario('otro')
})

test('desactivar a un superadministrador exige escribir "desactivar <usuario>"', async () => {
  usuario('segundo', { superadmin: true })
  await assert.rejects(actualizar(req('jefe', { estado: 'inactivo' }), 'segundo'), {
    statusCode: 400,
    message: 'Para continuar escriba exactamente: desactivar segundo',
  })
  await assert.rejects(
    actualizar(req('jefe', { estado: 'inactivo', confirmacion: 'desactivar jefe' }), 'segundo'),
    { statusCode: 400 },
  )
  assert.equal(leer('segundo').estado, 'activo')

  await actualizar(req('jefe', { estado: 'inactivo', confirmacion: 'desactivar segundo' }), 'segundo')
  assert.equal(leer('segundo').estado, 'inactivo')
  assert.equal(leer('segundo').superadmin, false)
})

test('un administrador común no puede tocar al superadministrador', async () => {
  await assert.rejects(
    actualizar(req('admin', { estado: 'inactivo', confirmacion: 'desactivar jefe' }), 'jefe'),
    { statusCode: 403 },
  )
  await assert.rejects(actualizar(req('admin', { nombre: 'Cambiado' }), 'jefe'), {
    statusCode: 403,
  })
  await assert.rejects(reiniciarPin(req('admin'), 'jefe'), { statusCode: 403 })
  assert.equal(leer('jefe').estado, 'activo')
  assert.equal(leer('jefe').pinHash, 'hash')
})

test('nunca queda el sistema sin superadministrador activo', async () => {
  await assert.rejects(
    actualizar(req('jefe', { estado: 'inactivo', confirmacion: 'desactivar jefe' }), 'jefe'),
    { statusCode: 400, message: /único superadministrador/ },
  )
  await assert.rejects(
    actualizar(req('jefe', { superadmin: false, confirmacion: 'revocar jefe' }), 'jefe'),
    { statusCode: 400, message: /único superadministrador/ },
  )
  assert.equal(leer('jefe').superadmin, true)
})

test('solo un superadministrador designa a otro; revocar exige "revocar <usuario>"', async () => {
  await assert.rejects(actualizar(req('admin', { superadmin: true }), 'otro'), {
    statusCode: 403,
  })
  await actualizar(req('jefe', { superadmin: true }), 'otro')
  assert.equal(leer('otro').superadmin, true)

  await assert.rejects(actualizar(req('jefe', { superadmin: false }), 'otro'), {
    message: 'Para continuar escriba exactamente: revocar otro',
  })
  await actualizar(req('jefe', { superadmin: false, confirmacion: 'revocar otro' }), 'otro')
  assert.equal(leer('otro').superadmin, false)
})

test('sin superadministradores, cualquier administrador designa al primero', async () => {
  registros.clear()
  usuario('admin')
  usuario('otro')
  await actualizar(req('admin', { superadmin: true }), 'admin')
  assert.equal(leer('admin').superadmin, true)
})

test('el superadministrador no se elimina sin revocarlo antes', async () => {
  await assert.rejects(eliminar(req('admin'), 'jefe'), { statusCode: 400 })
  assert.ok(registros.has(clave(k.usuario('jefe'))))
})

test('marcar superadmin a un usuario no administrador no tiene efecto', async () => {
  usuario('tec', { rol: 'tecnico' })
  await actualizar(req('jefe', { superadmin: true }), 'tec')
  assert.equal(leer('tec').superadmin, false)
})
