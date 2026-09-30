/* Modelo de dominio. Debe mantenerse en sintonía con backend/src/types.ts */

export type EstadoEquipo = 'operativo' | 'mantenimiento' | 'fuera_servicio'

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

export type TipoServicio = 'preventivo' | 'correctivo' | 'revision' | 'instalacion'

export type EstadoRevision = 'completado' | 'en_proceso' | 'pendiente'

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
  /** Claves de los objetos en S3. */
  fotosEntrada: string[]
  fotosSalida: string[]
  pdfKey: string | null
  firmaTecnico: { nombre: string; estilo: string; fecha: string } | null
  firmaCliente: {
    nombre: string
    cargo: string
    estilo: string
    fecha: string
  } | null
}

/** Revisión con enlaces temporales para ver fotos y PDF. */
export interface RevisionDetalle extends Revision {
  urls: {
    fotosEntrada: string[]
    fotosSalida: string[]
    pdf: string | null
  }
}

export type RolUsuario = 'admin' | 'tecnico' | 'cliente'

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
