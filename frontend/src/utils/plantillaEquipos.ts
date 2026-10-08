import type { Equipo } from '../types'

/**
 * Plantilla de carga masiva de equipos.
 *
 * Las columnas reproducen el cuadro de equipos que ya maneja la empresa, para
 * que se pueda copiar y pegar desde su hoja actual sin reorganizar nada.
 *
 * La empresa no aparece como columna: se elige en la pantalla al cargar el
 * archivo. Así la misma plantilla sirve para cualquier cliente y no hay forma
 * de asignar un equipo a la empresa equivocada por un error de escritura.
 *
 * SheetJS se carga solo al entrar a la pantalla de importación (import
 * dinámico), para no cargar el paquete en quienes nunca la usan.
 */

type CampoEquipo = keyof Omit<
  Equipo,
  'id' | 'empresaId' | 'estado' | 'ultimaRevision'
>

interface Columna {
  campo: CampoEquipo
  /** Encabezado tal como aparece en la plantilla. */
  titulo: string
  obligatorio: boolean
  ayuda: string
  ejemplo: string
  ancho: number
  /** Otros encabezados aceptados al leer, para admitir hojas ya existentes. */
  alias: string[]
}

export const COLUMNAS: Columna[] = [
  {
    campo: 'codigo',
    titulo: 'QR',
    obligatorio: true,
    ayuda: 'Identificador único que se imprime en la etiqueta',
    ejemplo: 'IFF_Mporth_1',
    ancho: 18,
    alias: ['codigo', 'código', 'id qr', 'qr'],
  },
  {
    campo: 'sistema',
    titulo: 'TIPO',
    obligatorio: false,
    ayuda: 'Sistema al que pertenece: VRFSamsung, CHWS, Vent. Mecanica, C. Frio',
    ejemplo: 'VRFSamsung',
    ancho: 16,
    alias: ['sistema', 'tipo sistema'],
  },
  {
    campo: 'tipo',
    titulo: 'EQUIPO TIPO',
    obligatorio: true,
    ayuda: 'UMA, UCO Refrigerante Variable, Unid. Extracción, Fancoil…',
    ejemplo: 'UMA',
    ancho: 28,
    alias: ['tipo de equipo', 'equipo_tipo', 'equipo - tipo'],
  },
  {
    campo: 'nombre',
    titulo: 'EQUIPO NOMBRE',
    obligatorio: false,
    ayuda: 'Denominación en planos, si la tiene',
    ejemplo: 'AHU-08',
    ancho: 18,
    alias: ['nombre', 'equipo_nombre', 'equipo - nombre'],
  },
  {
    campo: 'serial',
    titulo: 'ID',
    obligatorio: false,
    ayuda: 'Serial del fabricante',
    ejemplo: 'GX14-20030111-80',
    ancho: 22,
    alias: ['serial', 'serie', 'n serie'],
  },
  {
    campo: 'ubicacion',
    titulo: 'UBICACIÓN',
    obligatorio: true,
    ayuda: 'Dónde está instalado físicamente',
    ejemplo: 'Terraza Chiller',
    ancho: 26,
    alias: ['ubicacion', 'sitio', 'localizacion', 'localización'],
  },
  {
    campo: 'zona',
    titulo: 'Zona',
    obligatorio: false,
    ayuda: 'Zona o subsistema al que sirve',
    ejemplo: 'Sistema 2 · AHU 08',
    ancho: 26,
    alias: ['zona', 'area', 'área', 'sistema zona'],
  },
  {
    campo: 'marca',
    titulo: 'MARCA',
    obligatorio: false,
    ayuda: 'Fabricante',
    ejemplo: 'Samsung',
    ancho: 16,
    alias: ['marca', 'fabricante'],
  },
  {
    campo: 'modelo',
    titulo: 'MODELO',
    obligatorio: false,
    ayuda: 'Referencia del fabricante',
    ejemplo: 'Geniox 14.07',
    ancho: 20,
    alias: ['modelo', 'referencia'],
  },
  {
    campo: 'caudal',
    titulo: 'CAUDAL',
    obligatorio: false,
    ayuda: 'Caudal de aire. Aplica a manejadoras y extractores',
    ejemplo: '4902',
    ancho: 12,
    alias: ['caudal', 'cuadal', 'flujo'],
  },
  {
    campo: 'capacidad',
    titulo: 'CAPACIDAD',
    obligatorio: false,
    ayuda: 'Capacidad térmica. Aplica a condensadoras y chillers',
    ejemplo: '120000',
    ancho: 14,
    alias: ['capacidad', 'btu', 'potencia'],
  },
  {
    campo: 'tension',
    titulo: 'TENSION',
    obligatorio: false,
    ayuda: 'Tensión nominal en formato voltaje/fases/frecuencia',
    ejemplo: '208/3/60',
    ancho: 14,
    alias: ['tension', 'tensión', 'voltaje'],
  },
  {
    campo: 'corriente',
    titulo: 'CORRIENTE',
    obligatorio: false,
    ayuda: 'Corriente nominal',
    ejemplo: '12.4',
    ancho: 14,
    alias: ['corriente', 'amperaje', 'amperios'],
  },
]

/** Quita tildes, signos y espacios sobrantes para comparar encabezados. */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Relaciona cada encabezado del archivo con el campo que le corresponde. */
function mapearEncabezados(encabezados: string[]) {
  const mapa = new Map<number, CampoEquipo>()

  encabezados.forEach((bruto, i) => {
    const limpio = normalizar(String(bruto ?? ''))
    if (!limpio) return

    const columna = COLUMNAS.find(
      (c) =>
        normalizar(c.titulo) === limpio ||
        normalizar(c.campo) === limpio ||
        c.alias.some((a) => normalizar(a) === limpio),
    )
    if (columna) mapa.set(i, columna.campo)
  })

  return mapa
}

export interface FilaLeida {
  fila: number
  datos: Partial<Equipo>
}

export interface LecturaArchivo {
  filas: FilaLeida[]
  /** Encabezados del archivo que no corresponden a ningún campo conocido. */
  columnasIgnoradas: string[]
  /** Campos obligatorios que no se encontraron en el archivo. */
  faltantes: string[]
}

/**
 * Lee un archivo .xlsx, .xls o .csv y lo convierte en fichas de equipo.
 *
 * Tolera que el archivo tenga columnas de más, en otro orden o con los
 * encabezados escritos de otra forma.
 */
export async function leerArchivoEquipos(archivo: File): Promise<LecturaArchivo> {
  const XLSX = await import('xlsx')
  const buffer = await archivo.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })

  const hoja = libro.Sheets[libro.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene ninguna hoja con datos')

  // Se lee como matriz para poder localizar la fila de encabezados.
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  })
  if (matriz.length === 0) throw new Error('El archivo está vacío')

  // La fila de encabezados es la primera que reconozca al menos dos columnas.
  let iEncabezado = -1
  let mapa = new Map<number, CampoEquipo>()
  for (let i = 0; i < Math.min(matriz.length, 15); i++) {
    const candidato = mapearEncabezados((matriz[i] ?? []).map((v) => String(v ?? '')))
    if (candidato.size >= 2) {
      iEncabezado = i
      mapa = candidato
      break
    }
  }

  if (iEncabezado === -1) {
    throw new Error(
      'No se reconocieron las columnas. Descargue la plantilla y use sus encabezados.',
    )
  }

  const encabezados = (matriz[iEncabezado] ?? []).map((v) => String(v ?? '').trim())
  const columnasIgnoradas = encabezados.filter(
    (h, i) => h && !mapa.has(i) && normalizar(h) !== 'num',
  )

  const camposPresentes = new Set(mapa.values())
  const faltantes = COLUMNAS.filter(
    (c) => c.obligatorio && !camposPresentes.has(c.campo),
  ).map((c) => c.titulo)

  const filas: FilaLeida[] = []
  for (let i = iEncabezado + 1; i < matriz.length; i++) {
    const cruda = matriz[i] ?? []
    const datos: Partial<Equipo> = {}
    let tieneContenido = false

    for (const [col, campo] of mapa) {
      const valor = String(cruda[col] ?? '').trim()
      if (valor) tieneContenido = true
      // La plantilla solo contiene columnas de texto de la ficha.
      ;(datos as Record<string, string>)[campo] = valor
    }

    if (tieneContenido) filas.push({ fila: i + 1, datos })
  }

  return { filas, columnasIgnoradas, faltantes }
}

/**
 * Genera la plantilla en blanco.
 *
 * Incluye una fila de ejemplo y una hoja de instrucciones, porque la plantilla
 * la va a llenar alguien que no participó en esta conversación.
 */
export async function descargarPlantilla() {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  /* --- Hoja de carga --- */
  const encabezados = COLUMNAS.map((c) => c.titulo)
  const ejemplo = COLUMNAS.map((c) => c.ejemplo)
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ejemplo])
  hoja['!cols'] = COLUMNAS.map((c) => ({ wch: c.ancho }))

  // Comentario en cada encabezado con la ayuda del campo.
  COLUMNAS.forEach((c, i) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: i })
    const celda = hoja[ref]
    if (celda) {
      celda.c = [{ a: 'Solutions Machine', t: `${c.ayuda}\n\nEjemplo: ${c.ejemplo}` }]
    }
  })

  XLSX.utils.book_append_sheet(libro, hoja, 'Equipos')

  /* --- Hoja de instrucciones --- */
  const instrucciones: string[][] = [
    ['PLANTILLA DE CARGA DE EQUIPOS · Solutions Machine'],
    [],
    ['Cómo usarla'],
    ['1.', 'Escriba un equipo por fila en la hoja "Equipos".'],
    ['2.', 'Borre la fila de ejemplo antes de cargar el archivo.'],
    ['3.', 'No cambie los encabezados ni el orden de las columnas.'],
    ['4.', 'La empresa NO se escribe aquí: se elige al cargar el archivo.'],
    ['5.', 'Guarde y cárguelo en Equipos → Importar.'],
    [],
    ['Campos'],
    ['Columna', '¿Obligatorio?', 'Descripción', 'Ejemplo'],
    ...COLUMNAS.map((c) => [
      c.titulo,
      c.obligatorio ? 'Sí' : 'Opcional',
      c.ayuda,
      c.ejemplo,
    ]),
    [],
    ['Notas'],
    ['', 'El campo QR debe ser único en todo el inventario.'],
    ['', 'Si un dato no aplica, deje la celda vacía o escriba un guion.'],
    ['', 'Máximo 500 equipos por archivo.'],
  ]
  const hojaInfo = XLSX.utils.aoa_to_sheet(instrucciones)
  hojaInfo['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 62 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(libro, hojaInfo, 'Instrucciones')

  XLSX.writeFile(libro, 'Plantilla de equipos - Solutions Machine.xlsx')
}
