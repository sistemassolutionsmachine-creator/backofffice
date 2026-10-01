import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { ddb, k } from '../src/lib/dynamo.js'
import type { Peticion } from '../src/lib/http.js'
import { eliminar, obtener } from '../src/routes/catalogo.js'

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
    case 'QueryCommand':
      return {
        Items: structuredClone(
          [...registros.values()].filter(
            (r) => r[p.ExpressionAttributeNames['#pk']] === p.ExpressionAttributeValues[':pk'],
          ),
        ),
      }
    default:
      throw new Error(`Comando no simulado: ${cmd.constructor.name}`)
  }
})

const req = (body: unknown, rol: 'admin' | 'tecnico' = 'admin'): Peticion => ({
  metodo: 'POST',
  ruta: '/',
  segmentos: [],
  query: {},
  body,
  auth: { sub: 'us-1', usuario: 'admin', rol, exp: 9999999999 },
})
const catalogo = async () => JSON.parse((await obtener(req({}))).body)

beforeEach(() => {
  registros.clear()
  insertar({
    ...k.equipo('eq-1'),
    GSI2PK: 'T#EQUIPO',
    GSI2SK: 'X-1',
    id: 'eq-1',
    codigo: 'X-1',
    tipo: 'Unid. Extracción',
    sistema: 'CHWS',
  })
})

test('un tipo sin equipos se elimina y deja de ofrecerse', async () => {
  await eliminar(req({ campo: 'tipo', valor: 'Mini Split' }))
  assert.deepEqual((await catalogo()).ocultos.tipo, ['Mini Split'])
})

test('un tipo con equipos no se puede eliminar, aunque cambien mayúsculas o tildes', async () => {
  await assert.rejects(eliminar(req({ campo: 'tipo', valor: 'unid. extraccion' })), {
    statusCode: 400,
    message: 'No se puede eliminar «unid. extraccion»: 1 equipo lo usa.',
  })
  assert.deepEqual((await catalogo()).ocultos.tipo, [])
})

test('aplica igual al sistema y no duplica eliminaciones repetidas', async () => {
  await assert.rejects(eliminar(req({ campo: 'sistema', valor: 'CHWS' })), { statusCode: 400 })
  await eliminar(req({ campo: 'sistema', valor: 'C. Frio' }))
  await eliminar(req({ campo: 'sistema', valor: 'c. frío' }))
  assert.deepEqual((await catalogo()).ocultos.sistema, ['C. Frio'])
})

test('solo el administrador elimina y se validan los datos', async () => {
  await assert.rejects(eliminar(req({ campo: 'tipo', valor: 'Mini Split' }, 'tecnico')), {
    statusCode: 403,
  })
  await assert.rejects(eliminar(req({ campo: 'marca', valor: 'Samsung' })), { statusCode: 400 })
  await assert.rejects(eliminar(req({ campo: 'tipo', valor: '   ' })), { statusCode: 400 })
})
