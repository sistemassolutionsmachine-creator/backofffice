import { get, k, limpiar, nuevoId, put, query, remove, update } from '../lib/dynamo.js'
import {
  creado,
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  prohibido,
  sinContenido,
  type Peticion,
} from '../lib/http.js'
import type { Contrato, Empresa, Equipo } from '../types.js'

/** Comprueba que el contrato exista y pertenezca a la empresa indicada. */
async function validarContrato(contratoId: string, empresaId: string) {
  if (typeof contratoId !== 'string' || !contratoId) throw malaPeticion('Debe elegir un contrato')
  const contrato = await get<Contrato>(k.contrato(contratoId))
  if (!contrato) throw malaPeticion('El contrato indicado no existe')
  if (contrato.empresaId !== empresaId) {
    throw malaPeticion('El contrato pertenece a otra empresa')
  }
  if (contrato.estado !== 'activo') throw malaPeticion('El contrato está finalizado')
  return contrato
}

function indices(eq: Equipo) {
  return {
    GSI1PK: `EMPRESA#${eq.empresaId}`,
    GSI1SK: `EQUIPO#${eq.codigo}`,
    GSI2PK: 'T#EQUIPO',
    GSI2SK: eq.codigo,
  }
}

/** Los guiones de la hoja de cálculo significan "no aplica". */
function texto(valor: unknown): string {
  const t = String(valor ?? '').trim()
  return t === '-' || t === '--' || t === 'N/A' ? '' : t
}

/** Normaliza el código: sin espacios y en mayúsculas, como en la etiqueta. */
function normalizarCodigo(valor: unknown): string {
  return texto(valor).replace(/\s+/g, '').toUpperCase()
}

function armarEquipo(datos: Partial<Equipo>, empresaId: string, id?: string): Equipo {
  return {
    id: id ?? nuevoId('eq'),
    empresaId,
    contratoId: datos.contratoId ?? null,
    codigo: normalizarCodigo(datos.codigo),
    sistema: texto(datos.sistema),
    tipo: texto(datos.tipo),
    nombre: texto(datos.nombre),
    serial: texto(datos.serial),
    ubicacion: texto(datos.ubicacion),
    zona: texto(datos.zona),
    marca: texto(datos.marca),
    modelo: texto(datos.modelo),
    caudal: texto(datos.caudal),
    capacidad: texto(datos.capacidad),
    tension: texto(datos.tension),
    corriente: texto(datos.corriente),
    estado: datos.estado ?? 'operativo',
    ultimaRevision: datos.ultimaRevision ?? null,
  }
}

/** Devuelve el motivo por el que la ficha no es válida, o null si lo es. */
function motivoInvalido(eq: Equipo): string | null {
  if (!eq.codigo) return 'Falta el código QR'
  if (!eq.tipo) return 'Falta el tipo de equipo'
  if (!eq.ubicacion) return 'Falta la ubicación'
  return null
}

export async function listar(req: Peticion) {
  const auth = exigir(req)

  // El cliente queda acotado a su empresa, aunque pida otra por query string.
  const empresaId = auth.rol === 'cliente' ? auth.empresaId : req.query.empresa
  if (auth.rol === 'cliente' && !empresaId) return ok([])

  const equipos = empresaId
    ? await query<Equipo>({ index: 'GSI1', pk: `EMPRESA#${empresaId}`, sk: 'EQUIPO#' })
    : await query<Equipo>({ index: 'GSI2', pk: 'T#EQUIPO' })

  return ok(equipos.map(limpiar))
}

export async function obtener(req: Peticion, id: string) {
  const auth = exigir(req)
  const equipo = await get<Equipo>(k.equipo(id))
  if (!equipo) throw noEncontrado('Equipo no encontrado')
  if (auth.rol === 'cliente' && equipo.empresaId !== auth.empresaId) throw prohibido()
  return ok(limpiar(equipo))
}

/** Resolución del QR: /api/equipos/codigo/IFF_MPORTH_1 */
export async function porCodigo(req: Peticion, codigo: string) {
  const auth = exigir(req)
  const [equipo] = await query<Equipo>({
    index: 'GSI2',
    pk: 'T#EQUIPO',
    sk: normalizarCodigo(codigo),
    exacto: true,
  })
  if (!equipo) throw noEncontrado(`No existe un equipo con el código ${codigo}`)
  if (auth.rol === 'cliente' && equipo.empresaId !== auth.empresaId) throw prohibido()
  return ok(limpiar(equipo))
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Partial<Equipo>>(req)
  if (!datos.empresaId) throw malaPeticion('Debe indicar la empresa del equipo')

  const equipo = armarEquipo(datos, datos.empresaId)
  const motivo = motivoInvalido(equipo)
  if (motivo) throw malaPeticion(motivo)

  if (!equipo.contratoId) throw malaPeticion('Debe elegir el contrato de ingreso del equipo')
  await validarContrato(equipo.contratoId, equipo.empresaId)

  const [existente] = await query<Equipo>({
    index: 'GSI2',
    pk: 'T#EQUIPO',
    sk: equipo.codigo,
    exacto: true,
  })
  if (existente) throw malaPeticion(`Ya existe un equipo con el código ${equipo.codigo}`)

  await put({ ...k.equipo(equipo.id), ...indices(equipo), ...equipo })
  return creado(equipo)
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<Equipo>(k.equipo(id))
  if (!actual) throw noEncontrado('Equipo no encontrado')

  const datos = cuerpo<Partial<Equipo>>(req)
  const fusionado = armarEquipo(
    { ...actual, ...datos },
    datos.empresaId ?? actual.empresaId,
    id,
  )

  const motivo = motivoInvalido(fusionado)
  if (motivo) throw malaPeticion(motivo)

  if (fusionado.empresaId !== actual.empresaId) {
    throw malaPeticion('No se puede trasladar un equipo a otra empresa')
  }
  if (actual.contratoId && fusionado.contratoId !== actual.contratoId) {
    throw malaPeticion('El contrato de ingreso se conserva para mantener la trazabilidad')
  }
  if (!fusionado.contratoId) throw malaPeticion('Debe elegir el contrato de ingreso del equipo')
  if (fusionado.contratoId !== actual.contratoId) {
    await validarContrato(fusionado.contratoId, fusionado.empresaId)
  }

  const { id: _id, ...campos } = fusionado
  void _id
  await update(k.equipo(id), { ...campos, ...indices(fusionado) })
  return ok(fusionado)
}

export async function eliminar(req: Peticion, id: string) {
  exigir(req, 'admin')
  await remove(k.equipo(id))
  return sinContenido()
}

/* ---------- Carga masiva ---------- */

interface CuerpoImportacion {
  empresaId?: string
  /** Contrato bajo el que entran todos los equipos del archivo. */
  contratoId?: string
  equipos?: Partial<Equipo>[]
  /** Si es true, actualiza los equipos cuyo código ya exista. */
  actualizarExistentes?: boolean
}

interface ResultadoFila {
  fila: number
  codigo: string
  estado: 'creado' | 'actualizado' | 'omitido' | 'error'
  motivo?: string
}

/**
 * Carga un lote de equipos para una empresa.
 *
 * La empresa se elige en la aplicación, no viene en el archivo: así la misma
 * plantilla sirve para cualquier cliente y no hay forma de asignar un equipo
 * a la empresa equivocada por un error de escritura.
 *
 * Procesa todas las filas y devuelve el detalle de cada una: una fila con
 * problemas no cancela el resto de la carga.
 */
export async function importar(req: Peticion) {
  exigir(req, 'admin')
  const { empresaId, contratoId, equipos, actualizarExistentes } =
    cuerpo<CuerpoImportacion>(req)

  if (!empresaId) throw malaPeticion('Debe elegir la empresa a la que pertenecen')
  if (!Array.isArray(equipos) || equipos.length === 0) {
    throw malaPeticion('El archivo no contiene equipos')
  }
  if (equipos.length > 500) {
    throw malaPeticion('Cargue como máximo 500 equipos por archivo')
  }

  const empresa = await get<Empresa>(k.empresa(empresaId))
  if (!empresa) throw noEncontrado('La empresa indicada no existe')

  // El contrato se elige junto a la empresa y aplica a todo el archivo.
  if (!contratoId) throw malaPeticion('Debe elegir el contrato de ingreso de los equipos')
  await validarContrato(contratoId, empresaId)

  // Una sola lectura del inventario para detectar duplicados.
  const existentes = await query<Equipo>({ index: 'GSI2', pk: 'T#EQUIPO' })
  const porCodigoExistente = new Map(existentes.map((e) => [e.codigo, e]))
  const vistosEnArchivo = new Set<string>()

  const resultados: ResultadoFila[] = []

  for (const [i, datos] of equipos.entries()) {
    // +2 porque la primera fila del archivo son los encabezados.
    const fila = i + 2
    const equipo = armarEquipo({ ...datos, contratoId: contratoId ?? null }, empresaId)

    const motivo = motivoInvalido(equipo)
    if (motivo) {
      resultados.push({ fila, codigo: equipo.codigo, estado: 'error', motivo })
      continue
    }

    if (vistosEnArchivo.has(equipo.codigo)) {
      resultados.push({
        fila,
        codigo: equipo.codigo,
        estado: 'error',
        motivo: 'El código está repetido dentro del archivo',
      })
      continue
    }
    vistosEnArchivo.add(equipo.codigo)

    const previo = porCodigoExistente.get(equipo.codigo)
    if (previo) {
      if (previo.empresaId !== empresaId) {
        resultados.push({ fila, codigo: equipo.codigo, estado: 'error', motivo: 'El código pertenece a otra empresa' })
        continue
      }
      if (!actualizarExistentes) {
        resultados.push({
          fila,
          codigo: equipo.codigo,
          estado: 'omitido',
          motivo: 'Ya existe un equipo con este código',
        })
        continue
      }
      // Se conserva el historial: mismo identificador, estado y última visita.
      const fusionado = armarEquipo(
        { ...equipo, contratoId: previo.contratoId || contratoId, estado: previo.estado, ultimaRevision: previo.ultimaRevision },
        empresaId,
        previo.id,
      )
      await put({ ...k.equipo(previo.id), ...indices(fusionado), ...fusionado })
      resultados.push({ fila, codigo: equipo.codigo, estado: 'actualizado' })
      continue
    }

    await put({ ...k.equipo(equipo.id), ...indices(equipo), ...equipo })
    resultados.push({ fila, codigo: equipo.codigo, estado: 'creado' })
  }

  const cuenta = (e: ResultadoFila['estado']) =>
    resultados.filter((r) => r.estado === e).length

  return ok({
    empresa: empresa.nombre,
    total: resultados.length,
    creados: cuenta('creado'),
    actualizados: cuenta('actualizado'),
    omitidos: cuenta('omitido'),
    errores: cuenta('error'),
    // Solo se devuelve el detalle de lo que requiere atención.
    detalle: resultados.filter((r) => r.estado === 'error' || r.estado === 'omitido'),
  })
}
