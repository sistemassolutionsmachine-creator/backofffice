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
 * Ficha de un equipo.
 *
 * Los campos replican el cuadro de equipos que maneja la empresa, de modo que
 * una hoja de cálculo existente se pueda cargar sin transformaciones.
 */
export interface Equipo {
  id: string
  empresaId: string
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
