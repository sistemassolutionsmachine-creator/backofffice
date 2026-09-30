import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  Plus,
  QrCode,
  Save,
} from 'lucide-react'
import { Button, Card, PageHeader } from '../components/ui'
import { useData } from '../store/DataContext'
import { descargarEtiquetaQr, urlDeEquipo } from '../utils/qr'
import type { Equipo, EstadoEquipo } from '../types'

const tipos = [
  { valor: 'Servidor', prefijo: 'SRV' },
  { valor: 'UPS', prefijo: 'UPS' },
  { valor: 'Climatización', prefijo: 'AC' },
  { valor: 'Red', prefijo: 'SW' },
  { valor: 'Almacenamiento', prefijo: 'NAS' },
  { valor: 'Energía', prefijo: 'GEN' },
  { valor: 'Otro', prefijo: 'EQP' },
]

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

export function EquipoNuevoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { equipos, empresas, addEquipo } = useData()
  const qrRef = useRef<HTMLDivElement>(null)

  const [empresaId, setEmpresaId] = useState(params.get('empresa') ?? '')
  const [tipo, setTipo] = useState('Servidor')
  const [nombre, setNombre] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [serial, setSerial] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [responsable, setResponsable] = useState('')
  const [estado, setEstado] = useState<EstadoEquipo>('operativo')
  const [fecha, setFecha] = useState('2026-09-23')
  const [creado, setCreado] = useState<Equipo | null>(null)

  const codigoSugerido = useMemo(() => {
    const prefijo = tipos.find((t) => t.valor === tipo)?.prefijo ?? 'EQP'
    const existentes = equipos.filter((e) => e.codigo.startsWith(`${prefijo}-`)).length
    return `${prefijo}-${String(existentes + 1).padStart(3, '0')}`
  }, [tipo, equipos])

  const [codigo, setCodigo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [descargandoQr, setDescargandoQr] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codigoFinal = codigo.trim() || codigoSugerido
  const valido = empresaId && nombre.trim() && ubicacion.trim()

  const guardar = async () => {
    if (!valido || guardando) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await addEquipo({
        empresaId,
        codigo: codigoFinal,
        nombre: nombre.trim(),
        tipo,
        marca: marca.trim() || '—',
        modelo: modelo.trim() || '—',
        serial: serial.trim() || '—',
        ubicacion: ubicacion.trim(),
        fechaInstalacion: fecha,
        estado,
        ultimaRevision: null,
        responsable: responsable.trim() || 'Sin asignar',
      })
      setCreado(nuevo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el equipo')
    } finally {
      setGuardando(false)
    }
  }

  /* Pantalla de éxito con el QR generado */
  if (creado) {
    const empresa = empresas.find((e) => e.id === creado.empresaId)
    return (
      <div className="mx-auto max-w-md pt-6">
        <Card className="p-6 text-center sm:p-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-zinc-900">Equipo registrado</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-900">{creado.nombre}</span> quedó
            asignado a{' '}
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
                setNombre('')
                setMarca('')
                setModelo('')
                setSerial('')
                setCodigo('')
              }}
            >
              <Plus className="size-4" />
              Registrar otro equipo
            </Button>
          </div>
        </Card>
      </div>
    )
  }

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
      />

      {/* Asignación a empresa */}
      <Card className="space-y-4 border-l-4 border-l-brand-600 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-brand-600" />
          <h2 className="text-sm font-bold text-zinc-900">Empresa / proyecto</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className={inputCls + ' flex-1'}
          >
            <option value="">Seleccione la empresa propietaria…</option>
            {empresas.map((em) => (
              <option key={em.id} value={em.id}>
                {em.nombre} · {em.ciudad}
              </option>
            ))}
          </select>
          <Link to="/empresas?nueva=1">
            <Button variant="secondary" className="w-full sm:w-auto">
              <Plus className="size-4" />
              Nueva empresa
            </Button>
          </Link>
        </div>
        {!empresaId && (
          <p className="text-xs text-zinc-500">
            Todo equipo debe pertenecer a una empresa o proyecto para su trazabilidad.
          </p>
        )}
      </Card>

      {/* Datos del equipo */}
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-zinc-900">Datos del equipo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nombre del equipo *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Servidor de aplicaciones Dell R760"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={inputCls}
            >
              {tipos.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.valor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Código interno
            </label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder={codigoSugerido}
              className={inputCls + ' font-mono'}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Sugerido automáticamente: <span className="font-mono">{codigoSugerido}</span>
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Marca</label>
            <input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej: Dell"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Modelo</label>
            <input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ej: PowerEdge R760"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Serial</label>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Ej: DL-R760-1024X"
              className={inputCls + ' font-mono'}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Fecha de instalación
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Ubicación *
            </label>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej: Datacenter · Rack B2"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Responsable
            </label>
            <input
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Técnico a cargo"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Estado inicial
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoEquipo)}
              className={inputCls}
            >
              <option value="operativo">Operativo</option>
              <option value="mantenimiento">En mantenimiento</option>
              <option value="fuera_servicio">Fuera de servicio</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Vista previa del QR */}
      <Card className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:p-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <QRCodeSVG
            value={urlDeEquipo(codigoFinal)}
            size={96}
            fgColor={valido ? '#0a0a0c' : '#d4d4d8'}
            marginSize={1}
          />
        </div>
        <div className="text-center sm:text-left">
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-zinc-900 sm:justify-start">
            <QrCode className="size-4 text-brand-600" />
            Vista previa del QR · <span className="font-mono">{codigoFinal}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            El QR enlaza a la ficha del equipo. Al escanearlo, el técnico accede
            directamente a su historial y formulario de revisión.
          </p>
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
