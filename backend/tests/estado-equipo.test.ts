import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { ddb, k } from '../src/lib/dynamo.js'
import type { Peticion } from '../src/lib/http.js'
import { actualizar, crear } from '../src/routes/revisiones.js'

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
    case 'UpdateCommand': {
      // Contador de consecutivos: ADD atómico.
      if (p.UpdateExpression.startsWith('ADD')) return { Attributes: { valor: 1 } }
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
      return {
        Items: structuredClone(
          [...registros.values()].filter(
            (r) => r.PK === v[':pk'] && (!v[':sk'] || String(r.SK).startsWith(v[':sk'])),
          ),
        ),
      }
    }
    default:
      throw new Error(`Comando no simulado: ${cmd.constructor.name}`)
  }
})

const req = (body: unknown): Peticion => ({
  metodo: 'POST',
  ruta: '/',
  segmentos: [],
  query: {},
  body,
  auth: { sub: 'us-tec', usuario: 'tecnico', rol: 'tecnico', exp: 9999999999 },
})
const equipo = () => registros.get(clave(k.equipo('eq-1')))!

beforeEach(() => {
  registros.clear()
  insertar({
    ...k.equipo('eq-1'),
    id: 'eq-1',
    empresaId: 'em-1',
    estado: 'operativo',
    ultimaRevision: '2026-09-01',
  })
})

async function abrir(fecha = '2026-10-01') {
  return JSON.parse(
    (await crear(req({ equipoId: 'eq-1', estado: 'en_proceso', fecha }))).body,
  )
}

test('completar exige indicar en qué estado queda el equipo', async () => {
  const r = await abrir()
  await assert.rejects(actualizar(req({ estado: 'completado' }), 'eq-1', r.id), {
    statusCode: 400,
    message: /estado queda el equipo/,
  })
  assert.equal(equipo().estado, 'operativo')
})

test('al completar, la revisión guarda el estado y el equipo lo refleja', async () => {
  const r = await abrir()
  const res = JSON.parse(
    (
      await actualizar(
        req({ estado: 'completado', estadoEquipo: 'fuera_servicio' }),
        'eq-1',
        r.id,
      )
    ).body,
  )
  assert.equal(res.estadoEquipo, 'fuera_servicio')
  assert.equal(equipo().estado, 'fuera_servicio')
})

test('rechaza estados de equipo desconocidos', async () => {
  const r = await abrir()
  await assert.rejects(
    actualizar(req({ estado: 'completado', estadoEquipo: 'roto' }), 'eq-1', r.id),
    { statusCode: 400, message: 'Estado del equipo inválido' },
  )
})

test('un reporte atrasado no pisa el estado de una visita posterior', async () => {
  const atrasado = await abrir('2026-09-15')
  // Visita más reciente registrada después.
  registros.set(clave(k.equipo('eq-1')), {
    ...equipo(),
    estado: 'operativo',
    ultimaRevision: '2026-10-01',
  })
  await actualizar(
    req({ estado: 'completado', estadoEquipo: 'mantenimiento' }),
    'eq-1',
    atrasado.id,
  )
  assert.equal(equipo().estado, 'operativo')
})
