import { get, k, limpiar, nuevoId, put, query, remove, update } from '../lib/dynamo.js'
import {
  creado,
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  sinContenido,
  type Peticion,
} from '../lib/http.js'
import type { Contrato, Empresa, Equipo } from '../types.js'

function indices(c: Contrato) {
  return {
    GSI1PK: `EMPRESA#${c.empresaId}`,
    GSI1SK: `CONTRATO#${c.codigo}`,
    GSI2PK: 'T#CONTRATO',
    GSI2SK: `${c.fechaInicio}#${c.id}`,
  }
}

/** Identificador corto y legible: CT-2026-K3F9. */
function codigoNuevo() {
  const anio = new Date().getFullYear()
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CT-${anio}-${sufijo}`
}

function validar(c: Contrato) {
  if (typeof c.nombre !== 'string' || !c.nombre.trim() || c.nombre.length > 200) {
    throw malaPeticion('El nombre del contrato es obligatorio (máximo 200 caracteres)')
  }
  if (typeof c.codigo !== 'string' || !c.codigo.trim() || c.codigo.length > 80) {
    throw malaPeticion('El código del contrato no es válido')
  }
  const fechaValida = (f: unknown): f is string => typeof f === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f)) &&
    new Date(f).toISOString().slice(0, 10) === f
  if (!fechaValida(c.fechaInicio) || (c.fechaFin !== null && !fechaValida(c.fechaFin))) {
    throw malaPeticion('Las fechas del contrato no son válidas')
  }
  if (c.fechaFin && c.fechaFin < c.fechaInicio) throw malaPeticion('La fecha final debe ser posterior o igual al inicio')
  if (c.estado !== 'activo' && c.estado !== 'finalizado') throw malaPeticion('Estado de contrato inválido')
}

export async function listar(req: Peticion) {
  const auth = exigir(req)

  // El cliente queda acotado a su empresa.
  const empresaId = auth.rol === 'cliente' ? auth.empresaId : req.query.empresa
  if (auth.rol === 'cliente' && !empresaId) return ok([])

  const contratos = empresaId
    ? await query<Contrato>({
        index: 'GSI1',
        pk: `EMPRESA#${empresaId}`,
        sk: 'CONTRATO#',
      })
    : await query<Contrato>({ index: 'GSI2', pk: 'T#CONTRATO', ascendente: false })

  return ok(contratos.map(limpiar))
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Partial<Contrato>>(req)

  if (typeof datos.empresaId !== 'string' || !datos.empresaId) throw malaPeticion('Debe indicar la empresa del contrato')
  if (typeof datos.nombre !== 'string' || !datos.nombre.trim()) throw malaPeticion('El nombre del contrato es obligatorio')
  if (datos.codigo !== undefined && typeof datos.codigo !== 'string') throw malaPeticion('Código inválido')

  const empresa = await get<Empresa>(k.empresa(datos.empresaId))
  if (!empresa) throw noEncontrado('La empresa indicada no existe')

  const contrato: Contrato = {
    id: nuevoId('ct'),
    empresaId: datos.empresaId,
    codigo: datos.codigo?.trim().toUpperCase() || codigoNuevo(),
    nombre: datos.nombre.trim(),
    fechaInicio: datos.fechaInicio ?? new Date().toISOString().slice(0, 10),
    fechaFin: datos.fechaFin ?? null,
    estado: datos.estado ?? 'activo',
  }

  validar(contrato)
  await put({ ...k.contrato(contrato.id), ...indices(contrato), ...contrato })
  return creado(contrato)
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<Contrato>(k.contrato(id))
  if (!actual) throw noEncontrado('Contrato no encontrado')

  const datos = cuerpo<Partial<Contrato>>(req)
  const fusionado: Contrato = {
    ...limpiar(actual),
    nombre: datos.nombre ?? actual.nombre,
    fechaInicio: datos.fechaInicio ?? actual.fechaInicio,
    fechaFin: datos.fechaFin !== undefined ? datos.fechaFin : actual.fechaFin,
    estado: datos.estado ?? actual.estado,
    id,
  }

  validar(fusionado)
  fusionado.nombre = fusionado.nombre.trim()
  const { id: _id, ...campos } = fusionado
  void _id
  await update(k.contrato(id), { ...campos, ...indices(fusionado) })
  return ok(limpiar(fusionado))
}

export async function eliminar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const contrato = await get<Contrato>(k.contrato(id))
  if (!contrato) throw noEncontrado('Contrato no encontrado')

  // Un contrato con equipos demarcados no se borra: es trazabilidad.
  const equipos = await query<Equipo>({
    index: 'GSI1',
    pk: `EMPRESA#${contrato.empresaId}`,
    sk: 'EQUIPO#',
  })
  const asignados = equipos.filter((e) => e.contratoId === id).length
  if (asignados > 0) {
    throw malaPeticion(
      `No se puede eliminar: hay ${asignados} equipo(s) demarcados bajo este contrato. Puede marcarlo como finalizado.`,
    )
  }

  await remove(k.contrato(id))
  return sinContenido()
}
