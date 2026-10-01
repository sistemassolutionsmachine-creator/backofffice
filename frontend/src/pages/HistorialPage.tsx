import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Camera } from 'lucide-react'
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
              <div className="mt-3"><DescargarReporteButton revision={r} /></div>
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
