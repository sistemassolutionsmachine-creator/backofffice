import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  Lock,
  LoaderCircle,
  MessageSquarePlus,
  MinusCircle,
  PenLine,
  Plus,
  Save,
  Thermometer,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Button, Card, ESTADO_EQUIPO, PageHeader, cx } from '../components/ui'
import { Selector } from '../components/Selector'
import { api } from '../api/client'
import { hoyISO } from '../utils/fechas'
import { useData } from '../store/DataContext'
import { archivarReporte, descargarReporte } from '../utils/reporteArchivado'
import { ESTILOS_FIRMA, getFirma } from '../utils/firma'
import { nombreVisible } from '../types'
import type { EstadoEquipo, RevisionDetalle } from '../types'

/* ------------------------------------------------------------------ */
/* Catálogo del formato DM-MTT-001                                     */
/* ------------------------------------------------------------------ */

const MOTIVOS = [
  { id: 'comercial', label: 'Visita Comercial' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'preventivo', label: 'Mtto Preventivo' },
  { id: 'correctivo', label: 'Mtto Correctivo' },
] as const

const TIPOS_EQUIPO = [
  { id: 'CH', label: 'Chiller' },
  { id: 'AHU', label: 'Manejadora' },
  { id: 'ODU', label: 'Condensadora VRV' },
  { id: 'IDU', label: 'Unidad interior VRV' },
  { id: 'MS', label: 'Mini Split' },
  { id: 'BC', label: 'Bomba de condensado' },
  { id: 'CR', label: 'Campanas o rejillas' },
  { id: 'VT', label: 'Ventilador' },
] as const

type TipoEquipoId = (typeof TIPOS_EQUIPO)[number]['id']

const TODOS: TipoEquipoId[] = ['CH', 'AHU', 'ODU', 'IDU', 'MS', 'BC', 'CR', 'VT']

interface RutinaItem {
  texto: string
  aplica: TipoEquipoId[]
}

const RUTINA: RutinaItem[] = [
  { texto: 'Limpieza general de la unidad', aplica: TODOS },
  { texto: 'Limpieza de serpentines (según aplique)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Limpieza bandejas y drenajes', aplica: ['AHU', 'IDU', 'MS', 'BC'] },
  { texto: 'Limpieza filtros aire', aplica: ['AHU', 'IDU', 'MS'] },
  { texto: 'Limpieza filtros agua', aplica: ['CH', 'AHU'] },
  { texto: 'Limpieza puntos eléctricos', aplica: TODOS },
  { texto: 'Ajuste de correas (según aplique)', aplica: ['AHU'] },
  { texto: 'Revisión libre rotación de ventiladores', aplica: TODOS },
  { texto: 'Revisión y lubricación de rodamientos (según se requiera)', aplica: TODOS },
  { texto: 'Verificación de tuberías por fugas (refrigeración y agua)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Verificación de aislamiento tuberías y ductería (según aplique)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Inspección de mirillas de líquido (estado de humedad)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Inspección nivel de aceite', aplica: ['CH'] },
  { texto: 'Verificación estado de operación (comandos, ventiladores, válvulas, bombas, sensores)', aplica: TODOS },
  { texto: 'Revisión parámetros de operación panel de control (según aplique)', aplica: TODOS },
  { texto: 'Revisión de tableros equipos (ajuste de tarjetas, terminales y sulfatación)', aplica: TODOS },
  { texto: 'Revisión de conexiones eléctricas (ajuste de terminales y sulfatación)', aplica: TODOS },
  { texto: 'Mediciones eléctricas: voltajes y amperajes', aplica: TODOS },
  { texto: 'Medición de presión (según aplique)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Medición de temperatura Sum y Ret (equipo)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Medición de temperatura Sum y Ret (tubería agua)', aplica: ['CH', 'AHU'] },
  { texto: 'Medición de super heat y subcooling (según aplique)', aplica: ['CH', 'AHU', 'ODU', 'IDU', 'MS'] },
  { texto: 'Análisis de parámetros medidos', aplica: TODOS },
]

const INSPECCION_VISUAL = ['Estado de tapas, puertas y cerraduras', 'Identificación del equipo']

/* ------------------------------------------------------------------ */
/* Tipos de estado del formulario                                      */
/* ------------------------------------------------------------------ */

type CheckEstado = 'ok' | 'na' | null
type VisualEstado = 'bien' | 'mal' | null

interface RutinaEstado {
  estado: CheckEstado
  obs: string
  obsAbierta: boolean
}

interface MedicionMecanica {
  id: number
  tipo: 'temperatura' | 'presion' | 'otro'
  etiqueta: string
  sum: string
  ret: string
}

interface MedicionElectrica {
  id: number
  componente: string
  vab: string
  vbc: string
  vca: string
  il1: string
  il2: string
  il3: string
}

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                              */
/* ------------------------------------------------------------------ */

/* Base sin ancho: permite fijar w-* sin conflicto con w-full */
const inputBase =
  'rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'
const inputCls = `w-full ${inputBase}`

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Eye
  title: string
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-4" />
        </span>
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

/** Foto lista para mostrar en pantalla y para subir a S3. */
interface Foto {
  url: string
  /** Ausente al reanudar un borrador: la foto ya está en S3. */
  blob?: Blob
  nombre: string
  /** Clave en S3 cuando ya fue subida. */
  clave?: string
}

/**
 * Reconstruye el estado del formulario desde un reporte guardado sin
 * `borradorDatos` (creados con versiones anteriores, como los migrados).
 * Invierte las transformaciones de `datosReporte`.
 */
function snapshotDesdeRevision(r: RevisionDetalle): SnapshotFormulario {
  const rutina = RUTINA.map(() => ({ estado: null as CheckEstado, obs: '' }))
  for (const item of r.rutina ?? []) {
    const i = RUTINA.findIndex((def) => def.texto === item.item)
    if (i >= 0) {
      rutina[i] = {
        estado: item.estado === 'OK' ? 'ok' : item.estado === 'N/A' ? 'na' : null,
        obs: item.obs ?? '',
      }
    }
  }
  const tipoId = (r.tipoEquipo ?? '').split(' · ')[0]
  return {
    motivo: MOTIVOS.find((m) => m.label === r.motivo)?.id ?? 'preventivo',
    tipoEquipo: TIPOS_EQUIPO.some((t) => t.id === tipoId) ? (tipoId as TipoEquipoId) : null,
    visual: INSPECCION_VISUAL.map((_, i) => {
      const item = r.inspeccionVisual?.[i]
      return {
        estado: item?.estado === 'BIEN' ? ('bien' as const) : item?.estado === 'MAL' ? ('mal' as const) : null,
        obs: item?.obs ?? '',
      }
    }),
    rutina,
    medMec: (r.medicionesMecanicas ?? []).map((m, i) => ({
      id: i + 1,
      tipo: m.tipo === 'Temp de' ? ('temperatura' as const) : m.tipo === 'Presión de' ? ('presion' as const) : ('otro' as const),
      etiqueta: m.etiqueta,
      sum: m.v1,
      ret: m.v2,
    })),
    medElec: (r.medicionesElectricas ?? []).map((m, i) => ({ id: i + 1, ...m })),
    monitoreo: r.monitoreo ?? '',
    analisis: r.analisis ?? '',
    correctivos: r.correctivos ?? '',
    observaciones: r.observaciones ?? '',
    estadoEquipo: r.estadoEquipo ?? null,
    firmado: Boolean(r.firmaTecnico),
  }
}

/**
 * Estado crudo del formulario que viaja en el borrador.
 * Permite reanudar exactamente donde quedó, sin reconstruir nada.
 */
interface SnapshotFormulario {
  motivo: string
  tipoEquipo: TipoEquipoId | null
  visual: { estado: VisualEstado; obs: string }[]
  rutina: { estado: CheckEstado; obs: string }[]
  medMec: MedicionMecanica[]
  medElec: MedicionElectrica[]
  monitoreo: string
  analisis: string
  correctivos: string
  observaciones: string
  estadoEquipo: EstadoEquipo | null
  firmado: boolean
}

/**
 * Reduce la foto de cámara (8-12 MP) a máx. 1280px JPEG.
 * Sin esto, el celular repinta imágenes enormes en cada interacción
 * y toda la página se vuelve lenta; además la subida sería mucho más pesada.
 */
async function comprimirFoto(file: File): Promise<Foto> {
  const original = URL.createObjectURL(file)
  const nombre = file.name || 'foto.jpg'
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('No se pudo leer la foto'))
      img.src = original
    })
    const max = 1280
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return { url: original, blob: file, nombre }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', 0.82),
    )
    if (!blob) return { url: original, blob: file, nombre }
    URL.revokeObjectURL(original)
    return { url: URL.createObjectURL(blob), blob, nombre }
  } catch {
    return { url: original, blob: file, nombre }
  }
}

function PhotoCapture({
  titulo,
  hint,
  fotos,
  onChange,
}: {
  titulo: string
  hint: string
  fotos: Foto[]
  onChange: (fotos: Foto[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const nuevas = await Promise.all(Array.from(files).map(comprimirFoto))
    onChange([...fotos, ...nuevas])
  }

  const tomada = fotos.length > 0

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={cx(
          'flex size-14 items-center justify-center rounded-full transition-colors',
          tomada ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600',
        )}
      >
        {tomada ? <CheckCircle2 className="size-7" /> : <Camera className="size-7" />}
      </span>
      <p className="mt-3 text-sm font-bold text-zinc-900">{titulo}</p>
      <p className="mt-1 max-w-xs text-xs text-zinc-500">{hint}</p>

      {tomada && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {fotos.map((foto, i) => (
            <div
              key={foto.url}
              className="relative size-24 overflow-hidden rounded-xl shadow-sm ring-1 ring-zinc-200"
            >
              <img
                src={foto.url}
                alt={`Foto ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(fotos.filter((f) => f.url !== foto.url))}
                className="absolute top-1 right-1 rounded-full bg-ink-950/70 p-1 text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant={tomada ? 'secondary' : 'primary'}
        className="mt-4 w-full sm:w-auto sm:px-8"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" />
        {tomada ? 'Tomar otra foto' : 'Tomar foto'}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function RevisionFormPage() {
  const { equipos, recargar } = useData()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const modoTecnico = pathname.startsWith('/tecnico')
  const equipoParam = params.get('equipo') ?? 'eq-01'
  const revisionParam = params.get('revision')

  const [equipoId, setEquipoId] = useState(equipoParam)
  const [motivo, setMotivo] = useState<string>('preventivo')
  const [tipoEquipo, setTipoEquipo] = useState<TipoEquipoId | null>(null)

  const [visual, setVisual] = useState<{ estado: VisualEstado; obs: string }[]>(
    INSPECCION_VISUAL.map(() => ({ estado: null, obs: '' })),
  )

  const [rutina, setRutina] = useState<RutinaEstado[]>(
    RUTINA.map(() => ({ estado: null, obs: '', obsAbierta: false })),
  )

  const [medMec, setMedMec] = useState<MedicionMecanica[]>([
    { id: 1, tipo: 'temperatura', etiqueta: '', sum: '', ret: '' },
  ])
  const [medElec, setMedElec] = useState<MedicionElectrica[]>([
    { id: 1, componente: '', vab: '', vbc: '', vca: '', il1: '', il2: '', il3: '' },
  ])

  const [monitoreo, setMonitoreo] = useState('')
  const [analisis, setAnalisis] = useState('')
  const [correctivos, setCorrectivos] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [fotosEntrada, setFotosEntrada] = useState<Foto[]>([])
  const [fotosSalida, setFotosSalida] = useState<Foto[]>([])
  const [firmado, setFirmado] = useState(false)
  const [estadoEquipo, setEstadoEquipo] = useState<EstadoEquipo | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  // El consecutivo lo asigna el servidor al registrar el reporte.
  const [consecutivo, setConsecutivo] = useState<string | null>(null)
  const revisionRegistrada = useRef<{ id: string; equipoId: string; consecutivo: string } | null>(null)
  const equipo = equipos.find((e) => e.id === equipoId)
  const firmaTecnico = modoTecnico ? getFirma() : null

  /* ---------- Borradores y edición de reportes existentes ---------- */
  const [cargada, setCargada] = useState<RevisionDetalle | null>(null)
  const [cargando, setCargando] = useState(Boolean(revisionParam))
  const [borradorGuardado, setBorradorGuardado] = useState<string | null>(null)
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const guardandoRef = useRef(false)

  // Edición de un reporte ya completado (administrador). Firmado = solo lectura.
  // Un reporte "en proceso" se retoma con el flujo normal de completar.
  const modoEdicion = cargada?.estado === 'completado'
  const soloLectura = Boolean(cargada?.firmaCliente)

  /** Reconstruye el formulario desde el borrador guardado en el servidor. */
  useEffect(() => {
    if (!revisionParam) return
    let cancelado = false
    void (async () => {
      try {
        const detalle = await api.revisiones.obtener(equipoParam, revisionParam)
        if (cancelado) return
        const guardado = detalle.borradorDatos as SnapshotFormulario | null
        // Sin estado crudo (reportes de versiones anteriores o migrados), se
        // reconstruye desde los datos del propio reporte.
        const s =
          guardado && Array.isArray(guardado.visual) && Array.isArray(guardado.rutina)
            ? guardado
            : snapshotDesdeRevision(detalle)
        setMotivo(s.motivo)
        setTipoEquipo(s.tipoEquipo)
        setVisual(INSPECCION_VISUAL.map((_, i) => s.visual[i] ?? { estado: null, obs: '' }))
        setRutina(RUTINA.map((_, i) => ({ obsAbierta: false, ...(s.rutina[i] ?? { estado: null, obs: '' }) })))
        if (s.medMec.length > 0) setMedMec(s.medMec)
        if (s.medElec.length > 0) setMedElec(s.medElec)
        setMonitoreo(s.monitoreo)
        setAnalisis(s.analisis)
        setCorrectivos(s.correctivos)
        setObservaciones(s.observaciones)
        setEstadoEquipo(s.estadoEquipo)
        setFirmado(s.firmado)
        const aFotos = (claves: string[], urls: string[]): Foto[] =>
          claves.map((clave, i) => ({ clave, url: urls[i] ?? '', nombre: clave.split('/').at(-1) ?? 'foto.jpg' }))
        setFotosEntrada(aFotos(detalle.fotosEntrada, detalle.urls.fotosEntrada))
        setFotosSalida(aFotos(detalle.fotosSalida, detalle.urls.fotosSalida))
        setEquipoId(detalle.equipoId)
        setConsecutivo(detalle.consecutivo || null)
        revisionRegistrada.current = {
          id: detalle.id,
          equipoId: detalle.equipoId,
          consecutivo: detalle.consecutivo,
        }
        setCargada(detalle)
      } catch (e) {
        if (!cancelado) {
          setErrorGuardado(e instanceof Error ? e.message : 'No se pudo cargar el borrador')
        }
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionParam])

  /* El formulario queda bloqueado hasta tomar la foto de entrada */
  const fotoEntradaLista = fotosEntrada.length > 0
  const bloqueado = fotoEntradaLista ? false : ('pointer-events-none opacity-40 select-none' as const)
  const puedeCompletar =
    fotoEntradaLista &&
    fotosSalida.length > 0 &&
    estadoEquipo !== null &&
    (!modoTecnico || firmado)

  /* Ítems de rutina visibles según tipo de equipo seleccionado */
  const rutinaVisible = useMemo(
    () =>
      RUTINA.map((item, i) => ({ ...item, i })).filter(
        (item) => !tipoEquipo || item.aplica.includes(tipoEquipo),
      ),
    [tipoEquipo],
  )

  const completados = rutinaVisible.filter((it) => rutina[it.i].estado !== null).length
  const progreso = rutinaVisible.length
    ? Math.round((completados / rutinaVisible.length) * 100)
    : 0

  const setRutinaItem = (i: number, patch: Partial<RutinaEstado>) =>
    setRutina((r) => r.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  const setVisualItem = (i: number, patch: Partial<{ estado: VisualEstado; obs: string }>) =>
    setVisual((v) => v.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  /** Arma el paquete de datos que consumen tanto la API como el PDF. */
  const datosReporte = () => ({
    motivo: MOTIVOS.find((m) => m.id === motivo)?.label ?? motivo,
    tipoEquipo: tipoEquipo
      ? `${tipoEquipo} · ${TIPOS_EQUIPO.find((t) => t.id === tipoEquipo)?.label ?? ''}`
      : null,
    inspeccionVisual: INSPECCION_VISUAL.map((item, i) => ({
      item,
      estado: visual[i].estado === 'bien' ? 'BIEN' : visual[i].estado === 'mal' ? 'MAL' : '-',
      obs: visual[i].obs,
    })),
    rutina: rutinaVisible.map(({ texto, i }) => ({
      item: texto,
      estado: rutina[i].estado === 'ok' ? 'OK' : rutina[i].estado === 'na' ? 'N/A' : '-',
      obs: rutina[i].obs,
    })),
    medicionesMecanicas: medMec
      .filter((m) => m.etiqueta || m.sum || m.ret)
      .map((m) => ({
        tipo:
          m.tipo === 'temperatura' ? 'Temp de' : m.tipo === 'presion' ? 'Presión de' : 'Dato de',
        etiqueta: m.etiqueta,
        v1: m.sum,
        v2: m.ret,
      })),
    medicionesElectricas: medElec
      .filter((m) => m.componente || m.vab || m.vbc || m.vca || m.il1 || m.il2 || m.il3)
      .map((m) => ({
        componente: m.componente,
        vab: m.vab,
        vbc: m.vbc,
        vca: m.vca,
        il1: m.il1,
        il2: m.il2,
        il3: m.il3,
      })),
    monitoreo,
    analisis,
    correctivos,
    observaciones,
  })

  /** Estado crudo del formulario: viaja con el borrador para poder reanudarlo. */
  const snapshot = (): SnapshotFormulario => ({
    motivo,
    tipoEquipo,
    visual,
    rutina: rutina.map(({ estado, obs }) => ({ estado, obs })),
    medMec,
    medElec,
    monitoreo,
    analisis,
    correctivos,
    observaciones,
    estadoEquipo,
    firmado,
  })

  /** Sube a S3 las fotos que aún no tienen clave y devuelve todas las claves. */
  const subirPendientes = async (
    momento: 'entrada' | 'salida',
    fotos: Foto[],
    actualizarFotos: (f: Foto[]) => void,
  ) => {
    const rev = revisionRegistrada.current
    if (!rev) throw new Error('El reporte aún no está registrado')
    const subidas = await Promise.all(
      fotos.map(async (f) => {
        if (f.clave || !f.blob) return f
        const clave = await api.revisiones.subirEvidencia(rev.equipoId, rev.id, momento, f.blob, f.nombre)
        return { ...f, clave }
      }),
    )
    actualizarFotos(subidas)
    return subidas.map((f) => f.clave).filter((c): c is string => Boolean(c))
  }

  /** Guarda el avance como borrador en el servidor (automático y manual). */
  const guardarBorrador = async (manual = false) => {
    if (!equipo || guardandoRef.current || enviado || modoEdicion || soloLectura) return
    if (!fotoEntradaLista) return
    guardandoRef.current = true
    if (manual) setGuardandoBorrador(true)
    try {
      if (!revisionRegistrada.current) {
        const creada = await api.revisiones.crear({
          equipoId: equipo.id,
          tipo: motivo === 'correctivo' ? 'correctivo' : 'preventivo',
          estado: 'borrador',
          fecha: hoyISO(),
          ...datosReporte(),
          borradorDatos: snapshot(),
        })
        revisionRegistrada.current = { id: creada.id, equipoId: equipo.id, consecutivo: '' }
      }
      const rev = revisionRegistrada.current
      const [clavesEntrada, clavesSalida] = await Promise.all([
        subirPendientes('entrada', fotosEntrada, setFotosEntrada),
        subirPendientes('salida', fotosSalida, setFotosSalida),
      ])
      await api.revisiones.actualizar(rev.equipoId, rev.id, {
        ...datosReporte(),
        estadoEquipo,
        fotosEntrada: clavesEntrada,
        fotosSalida: clavesSalida,
        borradorDatos: snapshot(),
      })
      setBorradorGuardado(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }))
      if (manual) setErrorGuardado(null)
    } catch (e) {
      if (manual) {
        setErrorGuardado(e instanceof Error ? e.message : 'No se pudo guardar el borrador')
      }
    } finally {
      guardandoRef.current = false
      if (manual) setGuardandoBorrador(false)
    }
  }

  /* Guardado automático: espera 4 s tras el último cambio y guarda. */
  const huellaFormulario = JSON.stringify([snapshot(), fotosEntrada.length, fotosSalida.length])
  useEffect(() => {
    if (!fotoEntradaLista || enviado || cargando || modoEdicion || soloLectura || Boolean(guardando)) return
    const temporizador = window.setTimeout(() => void guardarBorrador(), 4000)
    return () => window.clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huellaFormulario, fotoEntradaLista, enviado, cargando])

  /** Descarta el borrador en el servidor y vuelve al inicio. */
  const descartarBorrador = async () => {
    const rev = revisionRegistrada.current
    if (!window.confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return
    setDescartando(true)
    try {
      if (rev && !rev.consecutivo) await api.revisiones.eliminarBorrador(rev.equipoId, rev.id)
      navigate(modoTecnico ? '/tecnico/escanear' : '/historial', { replace: true })
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'No se pudo eliminar el borrador')
      setDescartando(false)
    }
  }

  /**
   * Registra el reporte, archiva las evidencias y el PDF.
   *
   * Las fotos viajan del navegador a S3 con URL prefirmada: no pasan por la
   * API, así que no hay límites de tamaño ni esperas largas en el servidor.
   */
  const completar = async () => {
    if (!equipo || guardando) return
    setErrorGuardado(null)
    try {
      setGuardando('Registrando el reporte…')
      const firma =
        firmado && firmaTecnico
          ? { nombre: firmaTecnico.nombre, estilo: firmaTecnico.estilo, fecha: hoyISO() }
          : null
      if (!revisionRegistrada.current) {
        const creada = await api.revisiones.crear({
          equipoId: equipo.id,
          tipo: motivo === 'correctivo' ? 'correctivo' : 'preventivo',
          estado: 'en_proceso',
          fecha: hoyISO(),
          ...datosReporte(),
          borradorDatos: snapshot(),
          firmaTecnico: firma,
        })
        revisionRegistrada.current = {
          id: creada.id,
          equipoId: equipo.id,
          consecutivo: creada.consecutivo,
        }
      }
      const rev = revisionRegistrada.current

      const actual = await api.revisiones.obtener(rev.equipoId, rev.id)
      let consecutivoFinal = actual.consecutivo
      if (actual.estado !== 'completado') {
        setGuardando('Subiendo las fotografías…')
        const [clavesEntrada, clavesSalida] = await Promise.all([
          subirPendientes('entrada', fotosEntrada, setFotosEntrada),
          subirPendientes('salida', fotosSalida, setFotosSalida),
        ])

        // Al completar, el borrador toma consecutivo y entra al historial.
        const guardada = await api.revisiones.actualizar(rev.equipoId, rev.id, {
          ...datosReporte(),
          estado: 'completado',
          estadoEquipo,
          fotosEntrada: clavesEntrada,
          fotosSalida: clavesSalida,
          firmaTecnico: firma ?? undefined,
          borradorDatos: snapshot(),
        })
        consecutivoFinal = guardada.consecutivo
      }
      revisionRegistrada.current = { ...rev, consecutivo: consecutivoFinal }

      setGuardando('Generando y archivando el PDF…')
      await archivarReporte(rev.equipoId, rev.id)

      setConsecutivo(consecutivoFinal)
      setEnviado(true)
      // El servidor actualizó el estado del equipo: se refresca el inventario.
      void recargar()
    } catch (e) {
      setErrorGuardado(
        e instanceof Error ? e.message : 'No se pudo registrar el reporte. Intente de nuevo.',
      )
    } finally {
      setGuardando(null)
    }
  }

  /** Edición de un reporte registrado: guarda y deja el PDF regenerado. */
  const guardarCambios = async () => {
    const rev = revisionRegistrada.current
    if (!rev || guardando || soloLectura) return
    setErrorGuardado(null)
    try {
      setGuardando('Guardando los cambios…')
      const [clavesEntrada, clavesSalida] = await Promise.all([
        subirPendientes('entrada', fotosEntrada, setFotosEntrada),
        subirPendientes('salida', fotosSalida, setFotosSalida),
      ])
      await api.revisiones.actualizar(rev.equipoId, rev.id, {
        ...datosReporte(),
        estadoEquipo,
        fotosEntrada: clavesEntrada,
        fotosSalida: clavesSalida,
        borradorDatos: snapshot(),
      })
      setGuardando('Regenerando el PDF…')
      await archivarReporte(rev.equipoId, rev.id)
      void recargar()
      navigate('/historial', { replace: true })
    } catch (e) {
      setErrorGuardado(
        e instanceof Error ? e.message : 'No se pudieron guardar los cambios. Intente de nuevo.',
      )
    } finally {
      setGuardando(null)
    }
  }

  const descargarPdf = async () => {
    setGenerandoPdf(true)
    try {
      if (revisionRegistrada.current) await descargarReporte(revisionRegistrada.current)
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'No se pudo descargar el PDF')
    } finally {
      setGenerandoPdf(false)
    }
  }


  if (cargando) {
    return (
      <div className="flex justify-center pt-20 text-zinc-400">
        <LoaderCircle className="size-8 motion-safe:animate-spin" />
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Card className="p-8 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-9" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-zinc-900">Reporte registrado</h1>
          <p className="mt-2 text-sm text-zinc-500">
            El reporte{' '}
            <span className="font-mono font-bold text-zinc-900">{consecutivo}</span> fue
            guardado y el documento PDF quedó archivado en S3.
          </p>
          {errorGuardado && <p role="alert" className="mt-4 text-sm text-brand-700">{errorGuardado}</p>}
          <div className="mt-6 flex flex-col gap-2">
            <Button className="w-full" disabled={generandoPdf} onClick={descargarPdf}>
              <FileText className="size-4" />
              {generandoPdf ? 'Generando PDF…' : 'Descargar PDF del reporte'}
            </Button>
            {modoTecnico ? (
              <Link to="/tecnico/escanear">
                <Button variant="secondary" className="w-full">
                  Escanear otro QR
                </Button>
              </Link>
            ) : (
              <Link to="/historial">
                <Button variant="secondary" className="w-full">
                  Ir al historial
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <PageHeader
        title={modoEdicion ? 'Editar reporte de mantenimiento' : 'Reporte de mantenimiento'}
        subtitle="Formato DM-MTT-001 · Equipos aire acondicionado. Los datos del cliente y horas se registran automáticamente."
      />

      {soloLectura && (
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            Este reporte ya fue firmado por el cliente: es de solo lectura y no admite cambios.
          </p>
        </Card>
      )}

      {cargada?.estado === 'borrador' && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Borrador recuperado. Puede continuar donde quedó: el avance se guarda solo.
          </p>
        </Card>
      )}

      {/* Consecutivo */}
      <Card className="flex items-center justify-between gap-3 border-l-4 border-l-brand-600 p-4 sm:p-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Serial del reporte
          </p>
          <p className="mt-1 font-mono text-xl font-extrabold text-zinc-900">
            {consecutivo ?? 'Se asigna al completar'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs font-bold text-zinc-700">DM-MTT-001 · Rev. 1</p>
          <p className="mt-0.5 text-xs text-zinc-500">Generado automáticamente</p>
        </div>
      </Card>

      {/* Foto de entrada (obligatoria para habilitar el formulario) */}
      <Card
        className={cx(
          'p-5 sm:p-6',
          !fotoEntradaLista && 'border-brand-300 ring-2 ring-brand-500/20',
        )}
      >
        <PhotoCapture
          titulo="Foto de entrada · ANTES"
          hint="Tome la foto del estado inicial del equipo antes de intervenirlo."
          fotos={fotosEntrada}
          onChange={setFotosEntrada}
        />
        {!fotoEntradaLista && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-700">
            <Lock className="size-3.5" />
            El formulario se habilita al tomar la foto de entrada
          </p>
        )}
      </Card>

      {/* Motivo de la visita */}
      <Card className={cx('space-y-3 p-4 sm:p-5', bloqueado)}>
        <SectionTitle icon={ClipboardList} title="Motivo de la visita" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOTIVOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMotivo(m.id)}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors',
                motivo === m.id
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                  : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Datos del equipo */}
      <Card className={cx('space-y-4 p-4 sm:p-5', bloqueado)}>
        <SectionTitle
          icon={Gauge}
          title="Datos del equipo"
          hint="Seleccione el equipo: identificación, modelo, serial y ubicación se cargan solos."
        />
        {modoTecnico ? (
          equipo && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                Equipo identificado por QR:{' '}
                <span className="font-mono font-bold">{equipo.codigo}</span> ·{' '}
                {nombreVisible(equipo)}
              </span>
            </div>
          )
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Equipo</label>
            <Selector
              ariaLabel="Equipo"
              value={equipoId}
              onChange={setEquipoId}
              placeholder="Seleccione un equipo…"
              opciones={equipos.map((eq) => ({
                valor: eq.id,
                etiqueta: `${eq.codigo} · ${nombreVisible(eq)}`,
                punto: ESTADO_EQUIPO[eq.estado].dot,
              }))}
            />
          </div>
        )}
        {equipo && (
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Identificación
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">{equipo.codigo}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Modelo
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">{equipo.modelo}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Serial
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">{equipo.serial}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Ubicación
              </dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">{equipo.ubicacion}</dd>
            </div>
          </dl>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Tipo de equipo
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIPOS_EQUIPO.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoEquipo(tipoEquipo === t.id ? null : t.id)}
                className={cx(
                  'rounded-xl border px-2 py-2.5 text-center transition-colors',
                  tipoEquipo === t.id
                    ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30'
                    : 'border-zinc-300 bg-white hover:border-zinc-400',
                )}
              >
                <span
                  className={cx(
                    'block font-mono text-sm font-extrabold',
                    tipoEquipo === t.id ? 'text-brand-700' : 'text-zinc-800',
                  )}
                >
                  {t.id}
                </span>
                <span className="mt-0.5 block text-[11px] leading-tight text-zinc-500">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          {tipoEquipo && (
            <p className="mt-2 text-xs text-emerald-700">
              <Check className="mr-1 inline size-3.5" />
              La rutina de mantenimiento muestra solo los ítems que aplican a{' '}
              <span className="font-bold">{tipoEquipo}</span>.
            </p>
          )}
        </div>
      </Card>

      {/* Estado del equipo · inspección visual */}
      <Card className={cx('space-y-3 p-4 sm:p-5', bloqueado)}>
        <SectionTitle
          icon={Eye}
          title="Estado del equipo"
          hint="Inspección visual de los componentes."
        />
        <ul className="divide-y divide-zinc-100">
          {INSPECCION_VISUAL.map((item, i) => (
            <li key={item} className="space-y-2 py-3">
              <div className="flex flex-col items-center gap-2.5 text-center">
                <span className="text-sm text-zinc-700">{item}</span>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setVisualItem(i, { estado: visual[i].estado === 'bien' ? null : 'bien' })
                    }
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                      visual[i].estado === 'bien'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                    )}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Bien
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setVisualItem(i, { estado: visual[i].estado === 'mal' ? null : 'mal' })
                    }
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                      visual[i].estado === 'mal'
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                    )}
                  >
                    <MinusCircle className="size-3.5" />
                    Mal
                  </button>
                </div>
              </div>
              {visual[i].estado === 'mal' && (
                <input
                  value={visual[i].obs}
                  onChange={(e) => setVisualItem(i, { obs: e.target.value })}
                  placeholder="Describa el hallazgo…"
                  className={inputCls}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Rutina de mantenimiento general */}
      <Card className={cx('p-4 sm:p-5', bloqueado)}>
        <SectionTitle
          icon={ClipboardList}
          title="Rutina de mantenimiento general"
          hint={
            tipoEquipo
              ? `${rutinaVisible.length} ítems aplican para ${tipoEquipo}.`
              : 'Seleccione el tipo de equipo para filtrar los ítems aplicables.'
          }
        />

        {/* Progreso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700">
              {completados} de {rutinaVisible.length} ítems
            </span>
            <span className="font-mono font-bold text-zinc-900">{progreso}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        <ul className="mt-3 divide-y divide-zinc-100">
          {rutinaVisible.map(({ texto, aplica, i }) => {
            const it = rutina[i]
            return (
              <li key={texto} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-zinc-700">{texto}</p>
                    {!tipoEquipo && (
                      <p className="mt-0.5 font-mono text-[10px] tracking-wide text-zinc-400">
                        {aplica.length === TODOS.length ? 'TODOS' : aplica.join(' / ')}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRutinaItem(i, { estado: it.estado === 'ok' ? null : 'ok' })}
                      title="Realizado"
                      className={cx(
                        'flex size-9 items-center justify-center rounded-lg transition-colors',
                        it.estado === 'ok'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
                      )}
                    >
                      <Check className="size-4.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRutinaItem(i, { estado: it.estado === 'na' ? null : 'na' })}
                      title="No aplica"
                      className={cx(
                        'flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-bold transition-colors',
                        it.estado === 'na'
                          ? 'bg-zinc-700 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
                      )}
                    >
                      N/A
                    </button>
                    <button
                      type="button"
                      onClick={() => setRutinaItem(i, { obsAbierta: !it.obsAbierta })}
                      title="Agregar observación"
                      className={cx(
                        'flex size-9 items-center justify-center rounded-lg transition-colors',
                        it.obsAbierta || it.obs
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
                      )}
                    >
                      <MessageSquarePlus className="size-4.5" />
                    </button>
                  </div>
                </div>
                {it.obsAbierta && (
                  <input
                    value={it.obs}
                    onChange={(e) => setRutinaItem(i, { obs: e.target.value })}
                    placeholder="Observación…"
                    className={cx(inputCls, 'mt-2')}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {/* Mediciones mecánicas */}
      <Card className={cx('space-y-3 p-4 sm:p-5', bloqueado)}>
        <SectionTitle
          icon={Thermometer}
          title="Mediciones mecánicas"
          hint="Temperaturas y presiones de suministro / retorno."
        />
        <div className="space-y-3">
          {medMec.map((m) => (
            <div key={m.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center gap-2">
                <Selector
                  compacto
                  className="w-32 shrink-0 sm:w-36"
                  ariaLabel="Tipo de medición"
                  value={m.tipo}
                  onChange={(v) =>
                    setMedMec((arr) =>
                      arr.map((x) =>
                        x.id === m.id ? { ...x, tipo: v as MedicionMecanica['tipo'] } : x,
                      ),
                    )
                  }
                  opciones={[
                    { valor: 'temperatura', etiqueta: 'Temp de' },
                    { valor: 'presion', etiqueta: 'Presión de' },
                    { valor: 'otro', etiqueta: 'Dato de' },
                  ]}
                />
                <input
                  value={m.etiqueta}
                  onChange={(e) =>
                    setMedMec((arr) =>
                      arr.map((x) => (x.id === m.id ? { ...x, etiqueta: e.target.value } : x)),
                    )
                  }
                  placeholder="Ej. agua, refrigerante…"
                  className={cx('min-w-0 flex-1', inputBase)}
                />
                <button
                  type="button"
                  onClick={() => setMedMec((arr) => arr.filter((x) => x.id !== m.id))}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    {m.tipo === 'presion' ? 'Sum / Alta' : m.tipo === 'temperatura' ? 'Sum' : 'Valor 1'}
                  </label>
                  <input
                    value={m.sum}
                    onChange={(e) =>
                      setMedMec((arr) =>
                        arr.map((x) => (x.id === m.id ? { ...x, sum: e.target.value } : x)),
                      )
                    }
                    inputMode="decimal"
                    placeholder={m.tipo === 'presion' ? 'PSI' : m.tipo === 'temperatura' ? '°C / °F' : '—'}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                    {m.tipo === 'presion' ? 'Ret / Baja' : m.tipo === 'temperatura' ? 'Ret' : 'Valor 2'}
                  </label>
                  <input
                    value={m.ret}
                    onChange={(e) =>
                      setMedMec((arr) =>
                        arr.map((x) => (x.id === m.id ? { ...x, ret: e.target.value } : x)),
                      )
                    }
                    inputMode="decimal"
                    placeholder={m.tipo === 'presion' ? 'PSI' : m.tipo === 'temperatura' ? '°C / °F' : '—'}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            setMedMec((arr) => [
              ...arr,
              {
                id: (arr.at(-1)?.id ?? 0) + 1,
                tipo: 'temperatura',
                etiqueta: '',
                sum: '',
                ret: '',
              },
            ])
          }
        >
          <Plus className="size-4" />
          Agregar medición
        </Button>
      </Card>

      {/* Mediciones eléctricas */}
      <Card className={cx('space-y-3 p-4 sm:p-5', bloqueado)}>
        <SectionTitle
          icon={Zap}
          title="Mediciones eléctricas"
          hint="Voltajes AB / BC / CA (VAC) y corrientes por componente."
        />
        <div className="space-y-3">
          {medElec.map((m, idx) => (
            <div key={m.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={m.componente}
                  onChange={(e) =>
                    setMedElec((arr) =>
                      arr.map((x) => (x.id === m.id ? { ...x, componente: e.target.value } : x)),
                    )
                  }
                  placeholder={`Componente ${idx + 1} · Ej. compresor 1, ventilador…`}
                  className={cx('min-w-0 flex-1', inputBase)}
                />
                <button
                  type="button"
                  onClick={() => setMedElec((arr) => arr.filter((x) => x.id !== m.id))}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ['vab', 'V AB'],
                    ['vbc', 'V BC'],
                    ['vca', 'V CA'],
                    ['il1', 'I L1'],
                    ['il2', 'I L2'],
                    ['il3', 'I L3'],
                  ] as const
                ).map(([campo, label]) => (
                  <div key={campo}>
                    <label className="mb-1 block text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                      {label}
                    </label>
                    <input
                      value={m[campo]}
                      onChange={(e) =>
                        setMedElec((arr) =>
                          arr.map((x) =>
                            x.id === m.id ? { ...x, [campo]: e.target.value } : x,
                          ),
                        )
                      }
                      inputMode="decimal"
                      placeholder={campo.startsWith('v') ? 'VAC' : 'A'}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            setMedElec((arr) => [
              ...arr,
              {
                id: (arr.at(-1)?.id ?? 0) + 1,
                componente: '',
                vab: '',
                vbc: '',
                vca: '',
                il1: '',
                il2: '',
                il3: '',
              },
            ])
          }
        >
          <Plus className="size-4" />
          Agregar componente
        </Button>
      </Card>

      {/* Funcionamiento monitoreo + análisis */}
      <Card className={cx('space-y-4 p-4 sm:p-5', bloqueado)}>
        <SectionTitle icon={Activity} title="Funcionamiento y análisis" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Funcionamiento monitoreo
          </label>
          <input
            value={monitoreo}
            onChange={(e) => setMonitoreo(e.target.value)}
            placeholder="Estado del monitoreo del equipo…"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Análisis operación
          </label>
          <textarea
            rows={3}
            value={analisis}
            onChange={(e) => setAnalisis(e.target.value)}
            placeholder="Análisis del estado operativo del equipo…"
            className={cx(inputCls, 'resize-none')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Correctivos sugeridos
          </label>
          <textarea
            rows={3}
            value={correctivos}
            onChange={(e) => setCorrectivos(e.target.value)}
            placeholder="Acciones correctivas recomendadas…"
            className={cx(inputCls, 'resize-none')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Observaciones adicionales
          </label>
          <textarea
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Otras observaciones de la visita…"
            className={cx(inputCls, 'resize-none')}
          />
        </div>
      </Card>

      {/* Foto de salida (obligatoria para completar) */}
      <Card
        className={cx(
          'p-5 sm:p-6',
          bloqueado,
          fotoEntradaLista && fotosSalida.length === 0 && 'border-brand-300 ring-2 ring-brand-500/20',
        )}
      >
        <PhotoCapture
          titulo="Foto de salida · DESPUÉS"
          hint="Tome la foto del estado final del equipo una vez completado el servicio."
          fotos={fotosSalida}
          onChange={setFotosSalida}
        />
        {fotoEntradaLista && fotosSalida.length === 0 && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-brand-700">
            <Lock className="size-3.5" />
            El reporte se puede completar al tomar la foto de salida
          </p>
        )}
      </Card>

      {/* Estado en que queda el equipo (obligatorio para completar) */}
      <Card
        className={cx(
          'space-y-4 p-4 sm:p-5',
          bloqueado,
          fotoEntradaLista && !estadoEquipo && 'border-brand-300 ring-2 ring-brand-500/20',
        )}
      >
        <SectionTitle
          icon={Gauge}
          title="¿Cómo queda el equipo?"
          hint="Queda registrado en el historial y actualiza el estado del equipo en el inventario."
        />
        <div role="radiogroup" aria-label="Estado en que queda el equipo" className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(ESTADO_EQUIPO) as EstadoEquipo[]).map((id) => {
            const e = ESTADO_EQUIPO[id]
            const activo = estadoEquipo === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setEstadoEquipo(id)}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-semibold transition-all',
                  activo
                    ? 'border-zinc-900 bg-zinc-50 ring-2 ring-zinc-900/10'
                    : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <span className={cx('size-2.5 shrink-0 rounded-full', e.dot)} />
                <span className={activo ? 'text-zinc-900' : 'text-zinc-700'}>{e.label}</span>
                {activo && <Check className="ml-auto size-4 text-zinc-900" />}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Firmas */}
      {modoTecnico && firmaTecnico && (
        <Card className={cx('space-y-4 p-4 sm:p-5', bloqueado)}>
          <SectionTitle
            icon={PenLine}
            title="Firmas"
            hint="Como soporte de la visita, firma el técnico. El cliente firma en sitio."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Técnico */}
            <div
              className={cx(
                'rounded-xl border p-4 text-center',
                firmado ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200',
              )}
            >
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Representante técnico
              </p>
              {firmado ? (
                <>
                  <p
                    className="mt-2 truncate text-3xl leading-tight text-ink-900"
                    style={{ fontFamily: ESTILOS_FIRMA[firmaTecnico.estilo].font }}
                  >
                    {firmaTecnico.nombre}
                  </p>
                  <div className="mx-auto mt-1 w-44 border-t border-zinc-300" />
                  <p className="mt-1.5 text-xs font-semibold text-zinc-700">
                    {firmaTecnico.nombre}
                  </p>
                  <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    Firmado
                  </p>
                  <button
                    type="button"
                    onClick={() => setFirmado(false)}
                    className="mt-1 text-[11px] font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
                  >
                    Quitar firma
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setFirmado(true)}
                  className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 px-3 py-5 text-zinc-400 transition-colors hover:border-brand-400 hover:text-brand-600"
                >
                  <PenLine className="size-5" />
                  <span className="text-xs font-semibold">Toca para firmar</span>
                </button>
              )}
            </div>
            {/* Cliente */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                Representante del cliente
              </p>
              <p className="mt-6 text-sm text-zinc-400 italic">Pendiente por firmar</p>
              <div className="mx-auto mt-4 w-44 border-t border-zinc-300" />
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Firma en sitio al recibir el servicio
              </p>
            </div>
          </div>
        </Card>
      )}

      {errorGuardado && (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">{errorGuardado}</p>
        </Card>
      )}

      {/* Acciones */}
      {!soloLectura && fotoEntradaLista && fotosSalida.length > 0 && !estadoEquipo && (
        <p className="text-right text-xs font-semibold text-brand-700">
          Indique cómo queda el equipo para completar el reporte.
        </p>
      )}

      {modoEdicion ? (
        !soloLectura && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              className="sm:w-auto"
              disabled={Boolean(guardando)}
              onClick={() => void guardarCambios()}
            >
              <Save className="size-4" />
              {guardando ?? 'Guardar cambios y regenerar PDF'}
            </Button>
          </div>
        )
      ) : (
        <div className={cx('space-y-3', bloqueado)}>
          {borradorGuardado && (
            <p className="text-right text-xs font-medium text-zinc-500">
              <CheckCircle2 className="mr-1 inline size-3.5 text-emerald-500" />
              Borrador guardado a las {borradorGuardado}. Puede salir y retomarlo después.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {revisionRegistrada.current && !revisionRegistrada.current.consecutivo && (
              <Button
                variant="secondary"
                className="sm:w-auto"
                disabled={descartando || Boolean(guardando)}
                onClick={() => void descartarBorrador()}
              >
                <Trash2 className="size-4" />
                {descartando ? 'Eliminando…' : 'Eliminar borrador'}
              </Button>
            )}
            <Button
              variant="secondary"
              className="sm:w-auto"
              disabled={guardandoBorrador || Boolean(guardando)}
              onClick={() => void guardarBorrador(true)}
            >
              <Save className="size-4" />
              {guardandoBorrador ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button
              className="sm:w-auto"
              disabled={!puedeCompletar || Boolean(guardando)}
              onClick={() => void completar()}
            >
              <FileText className="size-4" />
              {guardando ?? 'Completar y generar PDF'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
