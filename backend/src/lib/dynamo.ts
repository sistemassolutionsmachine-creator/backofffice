import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'

/**
 * Diseño de tabla única (single-table design).
 *
 *  Entidad   | PK                  | SK                      | GSI1PK            | GSI1SK                  | GSI2PK     | GSI2SK
 *  ----------|---------------------|-------------------------|-------------------|-------------------------|------------|------------------
 *  Empresa   | EMPRESA#<id>        | META                    | —                 | —                       | T#EMPRESA  | <nombre>
 *  Contrato  | CONTRATO#<id>       | META                    | EMPRESA#<empId>   | CONTRATO#<codigo>       | T#CONTRATO | <inicio>#<id>
 *  Equipo    | EQUIPO#<id>         | META                    | EMPRESA#<empId>   | EQUIPO#<codigo>         | T#EQUIPO   | <codigo>
 *  Usuario   | USUARIO#<id>        | META                    | —                 | —                       | T#USUARIO  | <usuario>
 *  Revision  | EQUIPO#<equipoId>   | REVISION#<fecha>#<id>   | EMPRESA#<empId>   | REVISION#<fecha>#<id>   | T#REVISION | <fecha>#<id>
 *
 * GSI1 resuelve "hijos de una empresa"; GSI2 resuelve "listar todo de un tipo"
 * y "buscar por clave única" (código QR, nombre de usuario). Sin Scans.
 */

export const TABLE = process.env.TABLE_NAME ?? 'solutions-machine'

const client = new DynamoDBClient({})
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

export const k = {
  empresa: (id: string) => ({ PK: `EMPRESA#${id}`, SK: 'META' }),
  contrato: (id: string) => ({ PK: `CONTRATO#${id}`, SK: 'META' }),
  catalogo: () => ({ PK: 'CATALOGO#EQUIPOS', SK: 'META' }),
  equipo: (id: string) => ({ PK: `EQUIPO#${id}`, SK: 'META' }),
  usuario: (id: string) => ({ PK: `USUARIO#${id}`, SK: 'META' }),
  turno: (id: string) => ({ PK: `TURNO#${id}`, SK: 'META' }),
  revision: (equipoId: string, fecha: string, id: string) => ({
    PK: `EQUIPO#${equipoId}`,
    SK: `REVISION#${fecha}#${id}`,
  }),
}

type Registro = Record<string, unknown>

export async function put(item: object) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }))
}

export async function get<T>(key: Registro): Promise<T | null> {
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: key }))
  return (r.Item as T | undefined) ?? null
}

export async function remove(key: Registro) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: key }))
}

/** Actualiza solo los campos presentes en `patch`. */
export async function update(key: Registro, patch: Registro) {
  const campos = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (campos.length === 0) return

  const sets = campos.map((_, i) => `#c${i} = :v${i}`)
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}
  campos.forEach(([campo, valor], i) => {
    names[`#c${i}`] = campo
    values[`:v${i}`] = valor
  })

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: key,
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  )
}

interface OpcionesQuery {
  index?: 'GSI1' | 'GSI2'
  pk: string
  /** Prefijo del sort key (begins_with) o valor exacto si `exacto` es true. */
  sk?: string
  exacto?: boolean
  /** false = más recientes primero. */
  ascendente?: boolean
  limite?: number
}

export async function query<T>(o: OpcionesQuery): Promise<T[]> {
  const pkName = o.index ? `${o.index}PK` : 'PK'
  const skName = o.index ? `${o.index}SK` : 'SK'

  let expr = '#pk = :pk'
  const values: Record<string, unknown> = { ':pk': o.pk }
  const names: Record<string, string> = { '#pk': pkName }

  if (o.sk) {
    expr += o.exacto ? ' AND #sk = :sk' : ' AND begins_with(#sk, :sk)'
    names['#sk'] = skName
    values[':sk'] = o.sk
  }

  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: o.index,
      ConsistentRead: !o.index,
      KeyConditionExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ScanIndexForward: o.ascendente ?? true,
      Limit: o.limite,
    }),
  )
  return (r.Items as T[] | undefined) ?? []
}

const CLAVES_INTERNAS = ['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK']

/** Quita los atributos internos de indexación antes de responder. */
export function limpiar<T extends object>(item: T): T {
  const salida: Registro = {}
  for (const [campo, valor] of Object.entries(item)) {
    if (!CLAVES_INTERNAS.includes(campo)) salida[campo] = valor
  }
  return salida as T
}

export function nuevoId(prefijo: string) {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefijo}-${ts}${rnd}`
}
