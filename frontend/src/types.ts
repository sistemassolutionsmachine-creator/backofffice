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

export interface Equipo {
  id: string
  empresaId: string
  codigo: string
  nombre: string
  tipo: string
  marca: string
  modelo: string
  serial: string
  ubicacion: string
  fechaInstalacion: string
  estado: EstadoEquipo
  ultimaRevision: string | null
  responsable: string
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
  firmaCliente: { nombre: string; cargo: string; fecha: string } | null
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
