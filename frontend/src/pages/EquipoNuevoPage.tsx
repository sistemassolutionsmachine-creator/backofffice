import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Plus,
  QrCode,
  Save,
  Upload,
} from 'lucide-react'
import { Button, Card, ESTADO_EQUIPO, PageHeader } from '../components/ui'
import { Selector } from '../components/Selector'
import { useData } from '../store/DataContext'
import { api } from '../api/client'
import { ContratoSelect } from '../components/ContratoSelect'
import { SelectCreable, contarUsos, unirOpciones } from '../components/SelectCreable'
import { descargarEtiquetaQr, urlDeEquipo } from '../utils/qr'
import type { CampoCatalogo, CatalogoEquipos, Equipo, EstadoEquipo } from '../types'

/* Sistemas y tipos tomados del cuadro de equipos del cliente. */
const SISTEMAS = ['VRFSamsung', 'CHWS', 'Vent. Mecanica', 'C. Frio']

const TIPOS_EQUIPO = [
  'UMA',
  'UMA Fancoil Ducto',
  'UCO Refrigerante Variable',
  'UCO Refrigerante Variable Maestra',
  'UCO Refrigerante Variable Esclava',
  'Unid. Hidr. Fancoil Desnudo',
  'Unid. Extracción',
  'Unid. Suministro',
  'Unid. Ventilación',
  'Caja Vol. Var',
  'Chiller',
  'Mini Split',
  'Bomba de condensado',
  'Otro',
]

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-zinc-500">{ayuda}</p>}
    </div>
  )
}

export function EquipoNuevoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { equipos, empresas, addEquipo } = useData()
  const qrRef = useRef<HTMLDivElement>(null)

  const [empresaId, setEmpresaId] = useState(params.get('empresa') ?? '')
  const [contratoId, setContratoId] = useState(params.get('contrato') ?? '')
  const [codigo, setCodigo] = useState('')
  const [sistema, setSistema] = useState(SISTEMAS[0])
  const [tipo, setTipo] = useState(TIPOS_EQUIPO[0])
  const [nombre, setNombre] = useState('')
  const [serial, setSerial] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [zona, setZona] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [caudal, setCaudal] = useState('')
  const [capacidad, setCapacidad] = useState('')
  const [tension, setTension] = useState('')
  const [corriente, setCorriente] = useState('')
  const [estado, setEstado] = useState<EstadoEquipo>('operativo')

  const [creado, setCreado] = useState<Equipo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [descargandoQr, setDescargandoQr] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codigoSugerido = useMemo(() => {
    const n = equipos.filter((e) => /^AC-\d+$/i.test(e.codigo)).length
    return `AC-${String(n + 1).padStart(3, '0')}`
  }, [equipos])

  // Opciones fijas que el administrador eliminó (persisten en el servidor).
  const [ocultos, setOcultos] = useState<CatalogoEquipos['ocultos']>({ sistema: [], tipo: [] })
  useEffect(() => {
    api.catalogo
      .obtener()
      .then((c) => setOcultos(c.ocultos))
      .catch(() => {
        // Sin catálogo se muestra la lista completa: no impide registrar.
      })
  }, [])

  // Lo creado al registrar un equipo queda disponible para los siguientes.
  const sistemas = useMemo(
    () => unirOpciones(SISTEMAS, equipos.map((e) => e.sistema), ocultos.sistema),
    [equipos, ocultos.sistema],
  )
  const tiposEquipo = useMemo(
    () => unirOpciones(TIPOS_EQUIPO, equipos.map((e) => e.tipo), ocultos.tipo),
    [equipos, ocultos.tipo],
  )
  const usosSistema = useMemo(() => contarUsos(equipos.map((e) => e.sistema)), [equipos])
  const usosTipo = useMemo(() => contarUsos(equipos.map((e) => e.tipo)), [equipos])

  // Si el valor inicial fue eliminado del catálogo, se toma el primero disponible.
  useEffect(() => {
    if (sistemas.length && !sistemas.includes(sistema)) setSistema(sistemas[0])
    if (tiposEquipo.length && !tiposEquipo.includes(tipo)) setTipo(tiposEquipo[0])
    // Solo al cargar el catálogo: después, el valor elegido o creado manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocultos])

  /** Las opciones fijas se ocultan en el servidor; las recién creadas, solo aquí. */
  const eliminarOpcion = (campo: CampoCatalogo, base: string[]) => async (valor: string) => {
    if (!base.includes(valor)) return
    const c = await api.catalogo.eliminar(campo, valor)
    setOcultos(c.ocultos)
  }

  const codigoFinal = (codigo.trim() || codigoSugerido).toUpperCase()
  const valido = Boolean(empresaId && tipo && ubicacion.trim())
  const empresa = empresas.find((e) => e.id === (creado?.empresaId ?? empresaId))

  const guardar = async () => {
    if (!valido || guardando) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await addEquipo({
        empresaId,
        contratoId: contratoId || null,
        contratoIds: contratoId ? [contratoId] : [],
        codigo: codigoFinal,
        sistema,
        tipo,
        nombre: nombre.trim(),
        serial: serial.trim(),
        ubicacion: ubicacion.trim(),
        zona: zona.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        caudal: caudal.trim(),
        capacidad: capacidad.trim(),
        tension: tension.trim(),
        corriente: corriente.trim(),
        estado,
        ultimaRevision: null,
      })
      setCreado(nuevo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el equipo')
    } finally {
      setGuardando(false)
    }
  }

  /* ---------- Pantalla de éxito con el QR generado ---------- */
  if (creado) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <Card className="p-6 text-center sm:p-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-zinc-900">Equipo registrado</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-900">
              {creado.nombre || creado.tipo}
            </span>{' '}
            quedó asignado a{' '}
            <span className="font-semibold text-zinc-900">{empresa?.nombre}</span>.
          </p>

          {/* Vista previa de la etiqueta tal como se descargará */}
          <div
            ref={qrRef}
            className="mx-auto mt-5 w-56 overflow-hidden rounded-2xl border border-zinc-300 bg-white"
          >
            <div className="h-1.5 bg-brand-600" />
            <div className="px-4 pt-3 pb-4">
              <p className="text-[10px] leading-tight font-semibold tracking-wide text-zinc-500 uppercase">
                {empresa?.nombre ?? 'Sin empresa'}
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold text-zinc-900">
                {creado.codigo}
              </p>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG
                  value={urlDeEquipo(creado.codigo)}
                  size={160}
                  fgColor="#000000"
                  marginSize={0}
                />
              </div>
              <div className="mx-auto mt-3 h-px w-24 bg-zinc-200" />
              <p className="mt-2 text-xs font-bold text-zinc-900">Solutions Machine</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={descargandoQr}
              onClick={async () => {
                setDescargandoQr(true)
                try {
                  await descargarEtiquetaQr(creado.codigo, empresa?.nombre ?? '')
                } finally {
                  setDescargandoQr(false)
                }
              }}
            >
              <Download className="size-4" />
              {descargandoQr ? 'Generando…' : 'Descargar QR en PNG'}
            </Button>
            <Button
              variant="dark"
              className="w-full"
              onClick={() => navigate(`/equipos/${creado.id}`)}
            >
              Ver ficha del equipo
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setCreado(null)
                setCodigo('')
                setNombre('')
                setSerial('')
                setUbicacion('')
                setZona('')
              }}
            >
              <Plus className="size-4" />
              Registrar otro
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  /* ---------- Formulario ---------- */
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/equipos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        Equipos
      </Link>

      <PageHeader
        title="Registrar equipo"
        subtitle="Al guardar se genera el código QR único del equipo, listo para imprimir."
        actions={
          <Link to="/equipos/importar">
            <Button variant="secondary">
              <Upload className="size-4" />
              Cargar varios
            </Button>
          </Link>
        }
      />

      {/* Identificación */}
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-zinc-900">Identificación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Empresa">
            <Selector
              ariaLabel="Empresa"
              value={empresaId}
              onChange={(v) => { setEmpresaId(v); setContratoId('') }}
              placeholder="Seleccione una empresa…"
              opciones={empresas.map((em) => ({ valor: em.id, etiqueta: em.nombre }))}
            />
          </Campo>
          <ContratoSelect empresaId={empresaId} value={contratoId} onChange={setContratoId} />
          <Campo
            etiqueta="Código QR"
            ayuda={`Si lo deja vacío se usará ${codigoSugerido}`}
          >
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder={codigoSugerido}
              className={`${inputCls} font-mono uppercase`}
            />
          </Campo>
          <Campo etiqueta="Sistema">
            <SelectCreable
              value={sistema}
              onChange={setSistema}
              opciones={sistemas}
              conteos={usosSistema}
              onEliminar={eliminarOpcion('sistema', SISTEMAS)}
              ariaLabel="Sistema"
              sustantivo="sistema"
              placeholderBusqueda="Buscar o crear sistema…"
            />
          </Campo>
          <Campo etiqueta="Tipo de equipo">
            <SelectCreable
              value={tipo}
              onChange={setTipo}
              opciones={tiposEquipo}
              conteos={usosTipo}
              onEliminar={eliminarOpcion('tipo', TIPOS_EQUIPO)}
              ariaLabel="Tipo de equipo"
              sustantivo="tipo"
              placeholderBusqueda="Buscar o crear tipo de equipo…"
            />
          </Campo>
          <Campo etiqueta="Denominación" ayuda="Como aparece en planos, si la tiene">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="AHU-08"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Serial del fabricante">
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="GX14-20030111-80"
              className={inputCls}
            />
          </Campo>
        </div>
      </Card>

      {/* Ubicación */}
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-zinc-900">Ubicación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Ubicación física">
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Terraza Chiller"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Zona o subsistema">
            <input
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="Sistema 2 · AHU 08"
              className={inputCls}
            />
          </Campo>
        </div>
      </Card>

      {/* Ficha técnica */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Ficha técnica</h2>
          <p className="text-xs text-zinc-500">
            Complete solo lo que aplique a este tipo de equipo.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Marca">
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Samsung"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Modelo">
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Geniox 14.07"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Caudal" ayuda="Manejadoras y extractores">
            <input
              value={caudal}
              onChange={(e) => setCaudal(e.target.value)}
              placeholder="4902"
              inputMode="decimal"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Capacidad" ayuda="Condensadoras y chillers">
            <input
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              placeholder="120000"
              inputMode="decimal"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Tensión" ayuda="Voltaje / fases / frecuencia">
            <input
              value={tension}
              onChange={(e) => setTension(e.target.value)}
              placeholder="208/3/60"
              className={inputCls}
            />
          </Campo>
          <Campo etiqueta="Corriente">
            <input
              value={corriente}
              onChange={(e) => setCorriente(e.target.value)}
              placeholder="12.4"
              inputMode="decimal"
              className={inputCls}
            />
          </Campo>
        </div>
        <Campo etiqueta="Estado inicial">
          <Selector
            ariaLabel="Estado inicial"
            value={estado}
            onChange={(v) => setEstado(v as EstadoEquipo)}
            opciones={(Object.keys(ESTADO_EQUIPO) as EstadoEquipo[]).map((id) => ({
              valor: id,
              etiqueta: ESTADO_EQUIPO[id].label,
              punto: ESTADO_EQUIPO[id].dot,
            }))}
          />
        </Campo>
      </Card>

      {/* Vista previa del QR */}
      <Card className="flex flex-col items-center gap-3 p-4 text-center sm:p-5">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-zinc-900">Etiqueta que se generará</h2>
        </div>
        <div className="w-48 overflow-hidden rounded-2xl border border-zinc-300 bg-white">
          <div className="h-1.5 bg-brand-600" />
          <div className="px-3 pt-2.5 pb-3">
            <p className="text-[9px] leading-tight font-semibold tracking-wide text-zinc-500 uppercase">
              {empresa?.nombre ?? 'Elija una empresa'}
            </p>
            <p className="mt-1 font-mono text-base font-extrabold text-zinc-900">
              {codigoFinal}
            </p>
            <div className="mt-2 flex justify-center">
              <QRCodeSVG
                value={urlDeEquipo(codigoFinal)}
                size={130}
                fgColor="#000000"
                marginSize={0}
              />
            </div>
            <div className="mx-auto mt-2.5 h-px w-20 bg-zinc-200" />
            <p className="mt-1.5 text-[11px] font-bold text-zinc-900">Solutions Machine</p>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">{error}</p>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => navigate('/equipos')}>
          Cancelar
        </Button>
        <Button disabled={!valido || guardando} onClick={() => void guardar()}>
          <Save className="size-4" />
          {guardando ? 'Guardando…' : 'Guardar y generar QR'}
        </Button>
      </div>
    </div>
  )
}
