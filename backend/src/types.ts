/* Modelo de dominio compartido con el frontend. */

export type RolUsuario = 'admin' | 'tecnico' | 'cliente'
export type EstadoEquipo = 'operativo' | 'mantenimiento' | 'fuera_servicio'
export type TipoServicio = 'preventivo' | 'correctivo' | 'revision' | 'instalacion'
export type EstadoRevision = 'completado' | 'en_proceso' | 'pendiente'

export interface Empresa {
  id: string
  nombre: string
  nit: string
  contacto: string
  telefono: string
  ciudad: string
}

/**
 * Contrato de mantenimiento con una empresa.
 *
 * Una empresa puede tener varios contratos a lo largo del tiempo; cada
 * equipo queda demarcado bajo el contrato con el que entró.
 */
/** Campos de la ficha del equipo con lista de opciones administrable. */
export type CampoCatalogo = 'sistema' | 'tipo'

/**
 * Opciones del catálogo base que el administrador eliminó.
 *
 * Los valores que usan los equipos salen del propio inventario; aquí solo se
 * guardan las opciones fijas descartadas, para que dejen de ofrecerse.
 */
export interface CatalogoEquipos {
  ocultos: Record<CampoCatalogo, string[]>
}

export interface Contrato {
  id: string
  empresaId: string
  /** Identificador corto del contrato: CT-2026-A1B2. */
  codigo: string
  /** Descripción: "Mantenimiento HVAC 2026". */
  nombre: string
  fechaInicio: string
  fechaFin: string | null
  estado: 'activo' | 'finalizado'
}

/**
 * Ficha de un equipo.
 *
 * Los campos replican el cuadro de equipos que maneja la empresa, de modo que
 * una hoja de cálculo existente se pueda cargar sin transformaciones.
 */
export interface Equipo {
  id: string
  empresaId: string
  /** Contrato bajo el que entró el equipo. Null en inventarios antiguos. */
  contratoId: string | null
  /** Identificador impreso en la etiqueta QR. Único en todo el inventario. */
  codigo: string
  /** Sistema al que pertenece: VRF Samsung, CHWS, Ventilación mecánica… */
  sistema: string
  /** Tipo de equipo: UMA, Unid. Extracción, UCO Refrigerante Variable… */
  tipo: string
  /** Denominación en planos, si la tiene: AHU-08, IDU-01. */
  nombre: string
  /** Serial del fabricante. */
  serial: string
  ubicacion: string
  /** Zona o subsistema al que sirve. */
  zona: string
  marca: string
  modelo: string
  /** Caudal de aire. Aplica a manejadoras y extractores. */
  caudal: string
  /** Capacidad térmica. Aplica a condensadoras y chillers. */
  capacidad: string
  /** Tensión nominal, en formato 208/3/60. */
  tension: string
  corriente: string
  /* --- Campos que gestiona la aplicación, no la hoja de cálculo --- */
  estado: EstadoEquipo
  ultimaRevision: string | null
}

/** Nombre a mostrar: usa la denominación de planos si existe. */
export function nombreVisible(eq: Pick<Equipo, 'nombre' | 'tipo'>) {
  return eq.nombre?.trim() || eq.tipo
}

export interface Usuario {
  id: string
  nombre: string
  usuario: string
  email: string
  rol: RolUsuario
  empresaId?: string
  estado: 'activo' | 'inactivo'
  ultimoAcceso: string | null
  /** Administrador protegido: solo otro superadministrador puede gestionarlo. */
  superadmin?: boolean
  /**
   * Firma digital elegida por el usuario. Se guarda para no pedirla en cada
   * sesión: el técnico la define una vez y firma con un toque.
   */
  firma?: { nombre: string; estilo: string; cargo?: string } | null
}

/**
 * Usuario tal como se guarda. Ni el hash del PIN ni el del enlace de
 * activación salen nunca en las respuestas de la API.
 */
export interface UsuarioConPin extends Usuario {
  /** Vacío mientras el usuario no haya definido su PIN. */
  pinHash: string
  activacionHash?: string | null
  /** Epoch en segundos. */
  activacionExpira?: number | null
}

export interface Revision {
  id: string
  consecutivo: string
  equipoId: string
  empresaId: string
  tipo: TipoServicio
  tecnico: string
  tecnicoId: string
  fecha: string
  estado: EstadoRevision
  motivo: string
  tipoEquipo: string | null
  inspeccionVisual: { item: string; estado: string; obs: string }[]
  rutina: { item: string; estado: string; obs: string }[]
  medicionesMecanicas: { tipo: string; etiqueta: string; v1: string; v2: string }[]
  medicionesElectricas: {
    componente: string
    vab: string
    vbc: string
    vca: string
    il1: string
    il2: string
    il3: string
  }[]
  monitoreo: string
  analisis: string
  correctivos: string
  observaciones: string
  /** Claves S3 de las evidencias. */
  fotosEntrada: string[]
  fotosSalida: string[]
  /** Clave S3 del PDF generado. */
  pdfKey: string | null
  /** Estado en que el técnico dejó el equipo al cerrar el servicio. */
  estadoEquipo?: EstadoEquipo | null
  /** Versión del contenido y versión del PDF confirmado en S3. */
  documentoVersion?: number
  pdfVersion?: number
  firmaTecnico: { nombre: string; estilo: string; fecha: string } | null
  firmaCliente: {
    nombre: string
    cargo: string
    estilo: string
    fecha: string
  } | null
}

export interface TokenPayload {
  sub: string
  usuario: string
  rol: RolUsuario
  empresaId?: string
  exp: number
}
