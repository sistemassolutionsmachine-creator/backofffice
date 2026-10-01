import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { ddb, k } from '../src/lib/dynamo.js'
import { hashPin } from '../src/lib/auth.js'
import type { Peticion } from '../src/lib/http.js'
import * as contratos from '../src/routes/contratos.js'
import * as equipos from '../src/routes/equipos.js'
import { guardarFirma } from '../src/routes/usuarios.js'
import { login } from '../src/routes/auth.js'

// Única frontera simulada: transporte de DynamoDB. Las rutas, autorización,
// validaciones, serialización y login se ejecutan realmente, sin tocar AWS.
const registros = new Map<string, Record<string, any>>()
const clave = (v: Record<string, any>) => `${v.PK}|${v.SK}`
const insertar = (v: Record<string, any>) => registros.set(clave(v), structuredClone(v))
mock.method(ddb, 'send', async (cmd: any) => {
  const p = cmd.input
  switch (cmd.constructor.name) {
    case 'GetCommand': return { Item: structuredClone(registros.get(clave(p.Key))) }
    case 'PutCommand': insertar(p.Item); return {}
    case 'DeleteCommand': registros.delete(clave(p.Key)); return {}
    case 'UpdateCommand': {
      const item = { ...registros.get(clave(p.Key)) }
      Object.entries(p.ExpressionAttributeNames).forEach(([alias, campo]) => {
        assert.notEqual(campo, 'PK', 'DynamoDB no permite actualizar claves primarias')
        assert.notEqual(campo, 'SK', 'DynamoDB no permite actualizar claves primarias')
        item[campo as string] = p.ExpressionAttributeValues[alias.replace('#c', ':v')]
      })
      insertar({ ...p.Key, ...item }); return {}
    }
    case 'QueryCommand': {
      const names = p.ExpressionAttributeNames, values = p.ExpressionAttributeValues
      return { Items: structuredClone([...registros.values()].filter((r) =>
        r[names['#pk']] === values[':pk'] && (!names['#sk'] ||
          (p.KeyConditionExpression.includes('begins_with')
            ? r[names['#sk']]?.startsWith(values[':sk'])
            : r[names['#sk']] === values[':sk'])))) }
    }
    default: throw new Error(`Comando no simulado: ${cmd.constructor.name}`)
  }
})

function req(body: unknown = {}, rol: 'admin' | 'tecnico' | 'cliente' = 'admin', empresaId?: string): Peticion {
  return { metodo: 'POST', ruta: '/', segmentos: [], query: {}, body,
    auth: { sub: 'us-1', usuario: 'prueba', rol, empresaId, exp: 9999999999 } }
}
const equipoNuevo = { empresaId: 'em-1', contratoId: 'ct-1', codigo: 'QR-1', tipo: 'Chiller', ubicacion: 'Terraza' }
beforeEach(() => {
  registros.clear()
  insertar({ ...k.empresa('em-1'), id: 'em-1', nombre: 'Empresa uno' })
  for (const [id, empresaId, estado] of [['ct-1', 'em-1', 'activo'], ['ct-2', 'em-1', 'activo'], ['ct-3', 'em-2', 'activo'], ['ct-4', 'em-1', 'finalizado']]) {
    insertar({ ...k.contrato(id), id, empresaId, estado, nombre: id, codigo: id,
      fechaInicio: '2026-01-01', fechaFin: null, GSI1PK: `EMPRESA#${empresaId}`, GSI1SK: `CONTRATO#${id}`, GSI2PK: 'T#CONTRATO', GSI2SK: id })
  }
})

test('contratos: cliente solo ve su empresa y sin empresa no ve contratos', async () => {
  const peticion = req({}, 'cliente', 'em-1')
  peticion.query.empresa = 'em-2'
  assert.deepEqual(JSON.parse((await contratos.listar(peticion)).body).map((c: any) => c.id), ['ct-1', 'ct-2', 'ct-4'])
  assert.deepEqual(JSON.parse((await contratos.listar(req({}, 'cliente'))).body), [])
})

test('contratos: solo administrador crea, fechas imposibles o invertidas se rechazan', async () => {
  const datos = { empresaId: 'em-1', nombre: 'Contrato nuevo', fechaInicio: '2026-01-01' }
  await assert.rejects(contratos.crear(req(datos, 'tecnico')), { statusCode: 403 })
  await assert.rejects(contratos.crear(req({ ...datos, fechaInicio: '2026-02-30' })), { statusCode: 400 })
  await assert.rejects(contratos.crear(req({ ...datos, fechaFin: '2025-12-01' })), { statusCode: 400 })
  const creado = JSON.parse((await contratos.crear(req(datos))).body)
  assert.equal(creado.empresaId, 'em-1')
  assert.equal(registros.get(clave(k.contrato(creado.id)))?.nombre, datos.nombre)
})

test('contratos: editar un registro leído de DynamoDB no intenta modificar PK/SK', async () => {
  const r = JSON.parse((await contratos.actualizar(req({ nombre: 'Contrato renovado', estado: 'finalizado' }), 'ct-1')).body)
  assert.equal(r.nombre, 'Contrato renovado')
  assert.equal(r.estado, 'finalizado')
  assert.equal(r.PK, undefined)
  assert.equal(registros.get(clave(k.contrato('ct-1')))?.estado, 'finalizado')
})

test('equipos: exige contrato activo de la misma empresa', async () => {
  for (const contratoId of [null, 'inexistente', 'ct-3', 'ct-4']) {
    await assert.rejects(equipos.crear(req({ ...equipoNuevo, contratoId })), { statusCode: 400 })
  }
  const r = JSON.parse((await equipos.crear(req(equipoNuevo))).body)
  assert.equal(r.contratoId, 'ct-1')
  assert.equal(r.empresaId, 'em-1')
})

test('equipos: inventario anterior se asigna y no pierde identificación ni historial', async () => {
  insertar({ ...k.equipo('eq-viejo'), id: 'eq-viejo', ...equipoNuevo, contratoId: null, estado: 'mantenimiento', ultimaRevision: '2026-09-15' })
  const r = JSON.parse((await equipos.actualizar(req({ contratoId: 'ct-1' }), 'eq-viejo')).body)
  assert.equal(r.id, 'eq-viejo')
  assert.equal(r.contratoId, 'ct-1')
  assert.equal(r.ultimaRevision, '2026-09-15')
  assert.equal(r.estado, 'mantenimiento')
  await assert.rejects(equipos.actualizar(req({ contratoId: 'ct-2' }), 'eq-viejo'), { statusCode: 400 })
  await assert.rejects(equipos.actualizar(req({ contratoId: null }), 'eq-viejo'), { statusCode: 400 })
})

test('importación: separa nuevos de antiguos y conserva contrato e historial anteriores', async () => {
  insertar({ ...k.equipo('eq-antiguo'), id: 'eq-antiguo', ...equipoNuevo, estado: 'mantenimiento', ultimaRevision: '2026-09-01', GSI2PK: 'T#EQUIPO', GSI2SK: 'QR-1' })
  insertar({ ...k.equipo('eq-ajeno'), id: 'eq-ajeno', ...equipoNuevo, empresaId: 'em-2', codigo: 'AJENO', GSI2PK: 'T#EQUIPO', GSI2SK: 'AJENO' })
  const r = JSON.parse((await equipos.importar(req({ empresaId: 'em-1', contratoId: 'ct-2', actualizarExistentes: true,
    equipos: [equipoNuevo, { ...equipoNuevo, codigo: 'NUEVO' }, { ...equipoNuevo, codigo: 'AJENO' }] }))).body)
  assert.equal(r.creados, 1)
  assert.equal(r.actualizados, 1)
  assert.equal(r.errores, 1)
  const viejo = registros.get(clave(k.equipo('eq-antiguo')))!
  assert.equal(viejo.contratoId, 'ct-1')
  assert.equal(viejo.ultimaRevision, '2026-09-01')
  assert.equal(viejo.estado, 'mantenimiento')
  assert.equal([...registros.values()].find((v) => v.codigo === 'NUEVO')?.contratoId, 'ct-2')
  assert.equal(registros.get(clave(k.equipo('eq-ajeno')))?.empresaId, 'em-2')
})

test('contratos con equipos no se borran', async () => {
  insertar({ ...k.equipo('eq-1'), id: 'eq-1', ...equipoNuevo, GSI1PK: 'EMPRESA#em-1', GSI1SK: 'EQUIPO#QR-1' })
  await assert.rejects(contratos.eliminar(req(), 'ct-1'), { statusCode: 400 })
  assert.equal(registros.has(clave(k.contrato('ct-1'))), true)
})

test('firma: se guarda en el usuario autenticado y regresa en un nuevo login sin secretos', async () => {
  insertar({ ...k.usuario('us-1'), id: 'us-1', usuario: 'prueba', nombre: 'Técnico Uno', rol: 'tecnico', estado: 'activo', pinHash: hashPin('1234'), GSI2PK: 'T#USUARIO', GSI2SK: 'prueba' })
  const firma = { nombre: 'Técnico Uno', estilo: 'moderna', cargo: 'Técnico' }
  const r = JSON.parse((await guardarFirma(req({ ...firma, id: 'us-ajeno' }, 'tecnico'))).body)
  assert.deepEqual(r.firma, firma)
  assert.equal(r.pinHash, undefined)
  assert.equal(registros.has(clave(k.usuario('us-ajeno'))), false)
  const nuevoLogin = JSON.parse((await login(req({ usuario: 'prueba', pin: '1234' }))).body)
  assert.deepEqual(nuevoLogin.usuario.firma, firma)
  assert.equal(nuevoLogin.usuario.pinHash, undefined)
})

test('firma: rechaza estilos inválidos y no crea usuarios fantasma', async () => {
  await assert.rejects(guardarFirma(req({ nombre: 'Nombre', estilo: 'inventado' })), { statusCode: 400 })
  await assert.rejects(guardarFirma(req({ nombre: 'Nombre', estilo: 'clasica' })), { statusCode: 404 })
  assert.equal(registros.has(clave(k.usuario('us-1'))), false)
})
