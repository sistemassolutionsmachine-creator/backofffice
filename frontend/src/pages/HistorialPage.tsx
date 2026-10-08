import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Camera, FileText, PenLine, ShieldCheck, Trash2 } from 'lucide-react'
import {
  Card,
  EstadoRevisionBadge,
  PageHeader,
  SearchInput,
  TipoServicioBadge,
  cx,
} from '../components/ui'
import { api } from '../api/client'
import { DescargarReporteButton } from '../components/DescargarReporteButton'
import { Selector } from '../components/Selector'
import { formatFecha } from '../utils/fechas'
import { useData } from '../store/DataContext'
import { nombreVisible } from '../types'
import type { Revision, TipoServicio } from '../types'

const filtros: Array<{ id: TipoServicio | 'todos'; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'preventivo', label: 'Preventivos' },
  { id: 'correctivo', label: 'Correctivos' },
  { id: 'revision', label: 'Revisiones' },
]

/** Estado de supervisión y acciones del administrador sobre un reporte. */
function AccionesSupervision({
  revision,
  supervisando,
  onSupervisar,
}: {
  revision: Revision
  supervisando: boolean
  onSupervisar: (r: Revision) => void
}) {
  if (revision.estado !== 'completado') return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {revision.firmaCliente ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          <BadgeCheck className="size-3.5" />
          Firmado por el cliente
        </span>
      ) : (
        <>
          {revision.supervision ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200"
              title={`Supervisado por ${revision.supervision.por} · ${revision.supervision.fecha}`}
            >
              <ShieldCheck className="size-3.5" />
              Supervisado
            </span>
          ) : revision.requiereSupervision ? (
            <button
              type="button"
              disabled={supervisando}
              onClick={() => onSupervisar(revision)}
              title="El cliente podrá ver y firmar el reporte"
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-300 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              <ShieldCheck className="size-3.5" />
              {supervisando ? 'Guardando…' : 'Supervisión terminada'}
            </button>
          ) : null}
          {Boolean(revision.borradorDatos) && (
            <Link
              to={`/revisiones/nueva?equipo=${revision.equipoId}&revision=${revision.id}`}
              title="Editar los valores del reporte"
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-200"
            >
              <PenLine className="size-3.5" />
              Editar
            </Link>
          )}
        </>
      )}
    </div>
  )
}

/** Borradores guardados por los técnicos, recuperables desde el portal. */
function BorradoresDeTecnicos({ al }: { al: (mensaje: string) => void }) {
  const { getEquipo, getEmpresa } = useData()
  const [borradores, setBorradores] = useState<Revision[]>([])
  const [eliminando, setEliminando] = useState<string | null>(null)

  useEffect(() => {
    api.revisiones
      .borradores()
      .then(setBorradores)
      .catch(() => setBorradores([]))
  }, [])

  const eliminar = async (r: Revision) => {
    if (!window.confirm(`¿Eliminar el borrador de ${r.tecnico}? Esta acción no se puede deshacer.`)) return
    setEliminando(r.id)
    try {
      await api.revisiones.eliminarBorrador(r.equipoId, r.id)
      setBorradores((lista) => lista.filter((b) => b.id !== r.id))
    } catch (e) {
      al(e instanceof Error ? e.message : 'No se pudo eliminar el borrador')
    } finally {
      setEliminando(null)
    }
  }

  if (borradores.length === 0) return null

  return (
    <Card className="border-amber-200 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
        <FileText className="size-4 text-amber-600" />
        Borradores de técnicos
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
          {borradores.length}
        </span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Formularios sin terminar guardados durante el turno. Puede retomarlos o descartarlos.
      </p>
      <ul className="mt-3 divide-y divide-zinc-100">
        {borradores.map((r) => {
          const eq = getEquipo(r.equipoId)
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-zinc-800">
                  {eq ? `${eq.codigo} · ${nombreVisible(eq)}` : 'Equipo'}
                </p>
                <p className="text-xs text-zinc-500">
                  {r.tecnico} · {formatFecha(r.fecha)}
                  {eq ? ` · ${getEmpresa(eq.empresaId)?.nombre ?? ''}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  to={`/revisiones/nueva?equipo=${r.equipoId}&revision=${r.id}`}
                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200"
                >
                  Retomar
                </Link>
                <button
                  type="button"
                  disabled={eliminando === r.id}
                  onClick={() => void eliminar(r)}
                  title="Eliminar borrador"
                  className="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function HistorialPage() {
  const { empresas, getEmpresa, getEquipo } = useData()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<TipoServicio | 'todos'>('todos')
  // En la URL: así los enlaces desde Empresas llegan ya filtrados.
  const [params, setParams] = useSearchParams()
  const empresaFiltro = params.get('empresa') ?? ''
  const setEmpresaFiltro = (v: string) =>
    setParams(v ? { empresa: v } : {}, { replace: true })
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [, setCargando] = useState(true)
  const [supervisando, setSupervisando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const supervisar = async (r: Revision) => {
    setSupervisando(r.id)
    setAviso(null)
    try {
      const actualizada = await api.revisiones.supervisar(r.equipoId, r.id)
      setRevisiones((lista) =>
        lista.map((x) => (x.id === r.id ? { ...x, supervision: actualizada.supervision } : x)),
      )
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo terminar la supervisión')
    } finally {
      setSupervisando(null)
    }
  }

  // El filtro por empresa se resuelve en el servidor con el índice adecuado.
  useEffect(() => {
    let vigente = true
    setCargando(true)
    api.revisiones
      .listar(empresaFiltro ? { empresa: empresaFiltro } : {})
      .then((r) => {
        if (vigente) setRevisiones(r)
      })
      .catch(() => {
        if (vigente) setRevisiones([])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [empresaFiltro])

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase()
    return revisiones.filter((r) => {
      const eq = getEquipo(r.equipoId)
      if (filtro !== 'todos' && r.tipo !== filtro) return false
      if (!q) return true
      return [r.consecutivo, r.tecnico, r.observaciones, eq?.nombre, eq?.tipo, eq?.codigo]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [revisiones, query, filtro, getEquipo])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Historial de servicios"
        subtitle={`${revisiones.length} registros con consecutivo y trazabilidad completa`}
      />

      <BorradoresDeTecnicos al={setAviso} />

      {aviso && (
        <Card className="border-brand-200 bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-700">{aviso}</p>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por consecutivo, equipo, técnico…"
          />
          <Selector
            className="w-full sm:w-64"
            ariaLabel="Filtrar por empresa"
            value={empresaFiltro}
            onChange={setEmpresaFiltro}
            opciones={[
              { valor: '', etiqueta: 'Todas las empresas' },
              ...empresas.map((em) => ({ valor: em.id, etiqueta: em.nombre })),
            ]}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cx(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors',
                filtro === f.id
                  ? 'bg-ink-950 text-white'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards en móvil */}
      <div className="grid gap-3 md:hidden">
        {lista.map((r) => {
          const eq = getEquipo(r.equipoId)
          return (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-sm font-bold text-zinc-900">
                  {r.consecutivo}
                </span>
                <EstadoRevisionBadge estado={r.estado} />
              </div>
              <Link
                to={`/equipos/${r.equipoId}`}
                className="mt-1.5 block text-sm font-semibold text-zinc-900"
              >
                {eq ? nombreVisible(eq) : "Equipo"}
              </Link>
              <p className="mt-0.5 text-xs text-zinc-500">
                {eq ? (getEmpresa(eq.empresaId)?.nombre ?? 'Sin empresa') : ''}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{r.observaciones}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
                <TipoServicioBadge tipo={r.tipo} />
                <span>{r.tecnico}</span>
                <span>{formatFecha(r.fecha)}</span>
                <span className="flex items-center gap-1">
                  <Camera className="size-3.5" />
                  {r.fotosEntrada.length + r.fotosSalida.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <AccionesSupervision
                  revision={r}
                  supervisando={supervisando === r.id}
                  onSupervisar={(rev) => void supervisar(rev)}
                />
                {r.estado === 'completado' && <DescargarReporteButton revision={r} />}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Tabla en desktop */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              <th className="px-5 py-3.5">Consecutivo</th>
              <th className="px-5 py-3.5">Equipo</th>
              <th className="px-5 py-3.5">Tipo</th>
              <th className="px-5 py-3.5">Técnico</th>
              <th className="px-5 py-3.5">Fecha</th>
              <th className="px-5 py-3.5">Fotos</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5">Supervisión</th>
              <th className="px-5 py-3.5 text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {lista.map((r) => {
              const eq = getEquipo(r.equipoId)
              return (
                <tr key={r.id} className="transition-colors hover:bg-zinc-50/70">
                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-900">
                    {r.consecutivo}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/equipos/${r.equipoId}`}
                      className="font-semibold text-zinc-900 hover:text-brand-700"
                    >
                      {eq ? nombreVisible(eq) : "Equipo"}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      <span className="font-mono">{eq?.codigo}</span>
                      {eq ? ` · ${getEmpresa(eq.empresaId)?.nombre ?? 'Sin empresa'}` : ''}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <TipoServicioBadge tipo={r.tipo} />
                  </td>
                  <td className="px-5 py-3.5 text-zinc-600">{r.tecnico}</td>
                  <td className="px-5 py-3.5 text-zinc-600">{formatFecha(r.fecha)}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-zinc-600">
                      <Camera className="size-4 text-zinc-400" />
                      {r.fotosEntrada.length + r.fotosSalida.length}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <EstadoRevisionBadge estado={r.estado} />
                  </td>
                  <td className="px-5 py-3.5">
                    <AccionesSupervision
                      revision={r}
                      supervisando={supervisando === r.id}
                      onSupervisar={(rev) => void supervisar(rev)}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end">
                      {r.estado === 'completado' ? (
                        <DescargarReporteButton revision={r} />
                      ) : (
                        <span className="p-2 text-zinc-300">
                          <FileText className="size-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {lista.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold text-zinc-900">Sin resultados</p>
          <p className="mt-1 text-sm text-zinc-500">
            No se encontraron registros con los filtros aplicados.
          </p>
        </Card>
      )}
    </div>
  )
}
