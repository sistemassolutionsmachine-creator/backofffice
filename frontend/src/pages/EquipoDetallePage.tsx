import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Download,
  MapPin,
  Printer,
  Camera,
} from 'lucide-react'
import {
  Button,
  Card,
  EstadoEquipoBadge,
  EstadoEquipoPunto,
  EstadoRevisionBadge,
  TipoServicioBadge,
} from '../components/ui'
import { api } from '../api/client'
import { DescargarReporteButton } from '../components/DescargarReporteButton'
import { formatFecha } from '../utils/fechas'
import { useData } from '../store/DataContext'
import { descargarEtiquetaQr, urlDeEquipo } from '../utils/qr'
import { nombreVisible } from '../types'
import type { Revision } from '../types'

export function EquipoDetallePage() {
  const { id } = useParams()
  const { getEquipo, getEmpresa, contratos } = useData()
  const qrRef = useRef<HTMLDivElement>(null)
  const equipo = getEquipo(id ?? '')
  const [historial, setHistorial] = useState<Revision[]>([])
  const [descargandoQr, setDescargandoQr] = useState(false)

  useEffect(() => {
    if (!id) return
    let vigente = true
    api.revisiones
      .listar({ equipo: id })
      .then((r) => {
        if (vigente) setHistorial(r)
      })
      .catch(() => {
        if (vigente) setHistorial([])
      })
    return () => {
      vigente = false
    }
  }, [id])

  if (!equipo) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm font-semibold text-zinc-900">Equipo no encontrado</p>
        <Link to="/equipos" className="mt-2 inline-block text-sm text-brand-600">
          Volver al listado
        </Link>
      </Card>
    )
  }

  const empresa = getEmpresa(equipo.empresaId)
  const contrato = contratos.find((c) => c.id === equipo.contratoId)
  // Solo se listan los campos con contenido: la ficha varía mucho entre
  // un extractor y una condensadora.
  const specs = (
    [
      ['Código QR', equipo.codigo],
      ['Sistema', equipo.sistema],
      ['Tipo de equipo', equipo.tipo],
      ['Denominación', equipo.nombre],
      ['Serial', equipo.serial],
      ['Zona', equipo.zona],
      ['Marca', equipo.marca],
      ['Modelo', equipo.modelo],
      ['Caudal', equipo.caudal],
      ['Capacidad', equipo.capacidad],
      ['Tensión', equipo.tension],
      ['Corriente', equipo.corriente],
      ['Última revisión', formatFecha(equipo.ultimaRevision)],
    ] as Array<[string, string]>
  ).filter(([, valor]) => valor && valor !== '—')

  return (
    <div className="space-y-5">
      <Link
        to="/equipos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        Equipos
      </Link>

      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              {nombreVisible(equipo)}
            </h1>
            <EstadoEquipoBadge estado={equipo.estado} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-zinc-500">
            <span className="font-mono font-semibold text-zinc-700">{equipo.codigo}</span>
            · <MapPin className="size-3.5" /> {equipo.ubicacion} ·{' '}
            <Building2 className="size-3.5" /> {empresa?.nombre ?? 'Sin empresa'}
          </p>
        </div>
        <Link to={`/revisiones/nueva?equipo=${equipo.id}`}>
          <Button>
            <ClipboardList className="size-4" />
            Iniciar revisión
          </Button>
        </Link>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><p className="text-xs font-semibold text-zinc-500">Contrato de ingreso</p><p className="mt-1 text-sm font-bold text-zinc-900">{contrato ? `${contrato.codigo} · ${contrato.nombre}` : 'Pendiente de asignación'}</p></div>
        <Link to={`/contratos?empresa=${equipo.empresaId}`} className="text-sm font-semibold text-brand-700">Ver contratos →</Link>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ficha técnica */}
        <Card className="p-4 sm:p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-zinc-900">Ficha técnica</h2>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-50 px-3.5 py-2.5">
            <Building2 className="size-4 shrink-0 text-brand-600" />
            <p className="text-sm text-zinc-600">
              Asignado a{' '}
              <Link
                to={`/equipos?empresa=${equipo.empresaId}`}
                className="font-semibold text-zinc-900 hover:text-brand-700"
              >
                {empresa?.nombre ?? 'Sin empresa'}
              </Link>
              {empresa && empresa.ciudad !== '—' && (
                <span className="text-zinc-500"> · {empresa.ciudad}</span>
              )}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {specs.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-semibold break-words text-zinc-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* QR */}
        <Card className="flex flex-col items-center p-5 text-center">
          <h2 className="text-sm font-bold text-zinc-900">Código QR del equipo</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Imprima y adhiera esta etiqueta al equipo.
          </p>
          {/* Vista previa con el mismo diseño que tendrá la etiqueta impresa */}
          <div
            ref={qrRef}
            className="mt-4 w-full max-w-56 overflow-hidden rounded-2xl border border-zinc-300 bg-white"
          >
            <div className="h-1.5 bg-brand-600" />
            <div className="px-4 pt-3 pb-4">
              <p className="text-[10px] leading-tight font-semibold tracking-wide text-zinc-500 uppercase">
                {empresa?.nombre ?? 'Sin empresa'}
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold text-zinc-900">
                {equipo.codigo}
              </p>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG
                  value={urlDeEquipo(equipo.codigo)}
                  size={148}
                  fgColor="#000000"
                  marginSize={0}
                />
              </div>
              <div className="mx-auto mt-3 h-px w-24 bg-zinc-200" />
              <p className="mt-2 text-xs font-bold text-zinc-900">Solutions Machine</p>
            </div>
          </div>
          <div className="mt-4 flex w-full gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={descargandoQr}
              onClick={async () => {
                setDescargandoQr(true)
                try {
                  await descargarEtiquetaQr(equipo.codigo, empresa?.nombre ?? '')
                } finally {
                  setDescargandoQr(false)
                }
              }}
            >
              <Download className="size-4" />
              {descargandoQr ? 'Generando…' : 'Descargar'}
            </Button>
            <Button variant="dark" className="flex-1" onClick={() => window.print()}>
              <Printer className="size-4" />
              Imprimir
            </Button>
          </div>
        </Card>
      </div>

      {/* Historial */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Historial de servicios</h2>
            <p className="text-xs text-zinc-500">
              {historial.length} registros asociados a este equipo
            </p>
          </div>
        </div>

        {historial.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-sm font-semibold text-zinc-900">Aún sin servicios</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500">
              Este equipo todavía no tiene revisiones registradas. Inicie la primera
              revisión para comenzar su historial.
            </p>
          </div>
        )}

        {/* Móvil: línea de tiempo */}
        <ol className="relative space-y-5 border-l-2 border-zinc-100 pl-5 md:hidden">
          {historial.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-white bg-brand-600 ring-1 ring-zinc-200" />
              <div className="flex flex-col gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-zinc-900">
                      {r.consecutivo}
                    </span>
                    <TipoServicioBadge tipo={r.tipo} />
                    <EstadoRevisionBadge estado={r.estado} />
                  </div>
                  <p className="mt-2">
                    <EstadoEquipoPunto estado={r.estadoEquipo} />
                  </p>
                  {r.observaciones && (
                    <p className="mt-1.5 text-sm text-zinc-600">{r.observaciones}</p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{r.tecnico}</span>
                    <span>{formatFecha(r.fecha)}</span>
                    <span className="flex items-center gap-1">
                      <Camera className="size-3.5" />
                      {r.fotosEntrada.length + r.fotosSalida.length} fotos
                    </span>
                  </p>
                </div>
                {r.estado === 'completado' && <DescargarReporteButton revision={r} />}
              </div>
            </li>
          ))}
        </ol>

        {/* Escritorio: tabla con el estado en que quedó el equipo */}
        {historial.length > 0 && (
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                  <th className="px-4 py-3">Consecutivo</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Estado del equipo</th>
                  <th className="px-4 py-3">Reporte</th>
                  <th className="px-4 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {historial.map((r) => (
                  <tr key={r.id} className="align-top transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold whitespace-nowrap text-zinc-900">
                        {r.consecutivo}
                      </span>
                      {r.observaciones && (
                        <p className="mt-1 line-clamp-2 max-w-56 text-xs text-zinc-500">
                          {r.observaciones}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <TipoServicioBadge tipo={r.tipo} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-600">
                      {formatFecha(r.fecha)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600">{r.tecnico}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <EstadoEquipoPunto estado={r.estadoEquipo} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoRevisionBadge estado={r.estado} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end">
                        {r.estado === 'completado' && <DescargarReporteButton revision={r} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
