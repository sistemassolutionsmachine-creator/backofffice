import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Server,
  Upload,
} from 'lucide-react'
import {
  Button,
  Card,
  PageHeader,
  StatCard,
  TipoServicioBadge,
  cx,
} from '../components/ui'
import { useData } from '../store/DataContext'
import { api } from '../api/client'
import { fechaCorta } from '../utils/fechas'
import { nombreVisible } from '../types'
import type { EstadoEquipo, Equipo, Revision } from '../types'

const ESTADOS: Record<
  EstadoEquipo,
  { label: string; dot: string; text: string }
> = {
  operativo: { label: 'Operativo', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-amber-500', text: 'text-amber-600' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-brand-600', text: 'text-brand-700' },
}

/* Lo que falla va primero */
const PESO: Record<EstadoEquipo, number> = {
  fuera_servicio: 0,
  mantenimiento: 1,
  operativo: 2,
}

function footerDe(eq: Equipo): { label: string; valor: string } {
  if (eq.estado === 'fuera_servicio')
    return { label: 'Correctivo en curso', valor: `desde ${fechaCorta(eq.ultimaRevision)}` }
  if (eq.estado === 'mantenimiento')
    return { label: 'Revisión en curso', valor: fechaCorta(eq.ultimaRevision) }
  if (!eq.ultimaRevision) return { label: 'Última revisión', valor: 'sin registros' }
  return { label: 'Última revisión', valor: fechaCorta(eq.ultimaRevision) }
}

function EquipoRow({ eq, nRevisiones }: { eq: Equipo; nRevisiones: number }) {
  const est = ESTADOS[eq.estado]
  const footer = footerDe(eq)
  return (
    <Link
      to={`/equipos/${eq.id}`}
      className={cx(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5',
        eq.estado === 'fuera_servicio' && 'bg-brand-50/50 hover:bg-brand-50',
      )}
    >
      <span className={cx('size-2 shrink-0 rounded-full', est.dot)} title={est.label} />
      <span className="hidden w-20 shrink-0 font-mono text-xs font-semibold text-zinc-500 sm:block">
        {eq.codigo}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-900">
          {nombreVisible(eq)}
        </span>
        <span className="block truncate text-xs text-zinc-500">
          <span className="font-mono sm:hidden">{eq.codigo} · </span>
          {eq.ubicacion}
        </span>
      </span>
      <span
        className="hidden shrink-0 items-center gap-1 text-xs text-zinc-400 md:flex"
        title={`${nRevisiones} ${nRevisiones === 1 ? 'revisión registrada' : 'revisiones registradas'}`}
      >
        <FileText className="size-3.5" />
        {nRevisiones}
      </span>
      <span className="shrink-0 text-right">
        <span className="hidden text-[11px] text-zinc-500 sm:block">{footer.label}</span>
        <span
          className={cx(
            'block text-xs font-bold',
            eq.estado === 'operativo' ? 'text-zinc-900' : est.text,
          )}
        >
          {footer.valor}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-zinc-300" />
    </Link>
  )
}

function ActividadReciente({
  revisiones,
  equipos,
}: {
  revisiones: Revision[]
  equipos: Equipo[]
}) {
  const ultimas = revisiones.slice(0, 6)
  const getEquipo = (id: string) => equipos.find((e) => e.id === id)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-bold text-zinc-900">Actividad reciente</h2>
        <Link
          to="/historial"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Ver historial →
        </Link>
      </div>
      <ul className="divide-y divide-zinc-100">
        {ultimas.map((r) => {
          const eq = getEquipo(r.equipoId)
          return (
            <li key={r.id}>
              <Link
                to={`/equipos/${r.equipoId}`}
                className="block px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-900">
                    {r.consecutivo}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {fechaCorta(r.fecha)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-zinc-800">
                  {eq ? nombreVisible(eq) : "Equipo"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
                  <TipoServicioBadge tipo={r.tipo} />
                  <span className="truncate">{r.tecnico}</span>
                  <span className="flex items-center gap-1">
                    <Camera className="size-3" />
                    {r.fotosEntrada.length + r.fotosSalida.length}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function EquiposPage() {
  const { equipos, empresas, cargando } = useData()
  const [params] = useSearchParams()
  const [filtro, setFiltro] = useState<EstadoEquipo | 'todos'>('todos')
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({})
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const empresaFiltro = params.get('empresa') ?? ''

  // El historial alimenta el panel de actividad y el conteo por equipo.
  useEffect(() => {
    let vigente = true
    api.revisiones
      .listar()
      .then((r) => {
        if (vigente) setRevisiones(r)
      })
      .catch(() => {
        if (vigente) setRevisiones([])
      })
    return () => {
      vigente = false
    }
  }, [])

  const revisionesPorEquipo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of revisiones) {
      mapa.set(r.equipoId, (mapa.get(r.equipoId) ?? 0) + 1)
    }
    return mapa
  }, [revisiones])

  const conteos = useMemo(() => {
    const base = empresaFiltro
      ? equipos.filter((e) => e.empresaId === empresaFiltro)
      : equipos
    return {
      todos: base.length,
      operativo: base.filter((e) => e.estado === 'operativo').length,
      mantenimiento: base.filter((e) => e.estado === 'mantenimiento').length,
      fuera_servicio: base.filter((e) => e.estado === 'fuera_servicio').length,
    }
  }, [equipos, empresaFiltro])

  /* Empresas con sus equipos filtrados; las que tienen fallas, arriba */
  const grupos = useMemo(() => {
    return empresas
      .map((empresa) => {
        const lista = equipos
          .filter((e) => e.empresaId === empresa.id)
          .filter((e) => !empresaFiltro || e.empresaId === empresaFiltro)
          .filter((e) => filtro === 'todos' || e.estado === filtro)
          .sort((a, b) => PESO[a.estado] - PESO[b.estado])
        return { empresa, lista }
      })
      .filter((g) => g.lista.length > 0 && (!empresaFiltro || g.empresa.id === empresaFiltro))
      .sort(
        (a, b) =>
          Math.min(...a.lista.map((e) => PESO[e.estado])) -
          Math.min(...b.lista.map((e) => PESO[e.estado])),
      )
  }, [empresas, equipos, filtro, empresaFiltro])

  const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const empresaSel = empresas.find((e) => e.id === empresaFiltro)
  const atencion = conteos.mantenimiento + conteos.fuera_servicio

  const chips: Array<{ id: EstadoEquipo | 'todos'; label: string; n: number; dot?: string }> = [
    { id: 'todos', label: 'Todos', n: conteos.todos },
    { id: 'operativo', label: 'Operativos', n: conteos.operativo, dot: 'bg-emerald-500' },
    { id: 'mantenimiento', label: 'Mantenimiento', n: conteos.mantenimiento, dot: 'bg-amber-500' },
    { id: 'fuera_servicio', label: 'Fuera de servicio', n: conteos.fuera_servicio, dot: 'bg-brand-600' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={empresaSel ? empresaSel.nombre : 'Equipos'}
        subtitle={
          empresaSel
            ? `${conteos.todos} ${conteos.todos === 1 ? 'equipo' : 'equipos'} · ${hoy}`
            : `${equipos.length} equipos en ${new Set(equipos.map((e) => e.empresaId)).size} empresas · ${hoy}`
        }
        actions={
          <>
            <Link to="/equipos/importar">
              <Button variant="secondary">
                <Upload className="size-4" />
                Importar
              </Button>
            </Link>
            <Link to="/equipos/nuevo">
              <Button>
                <Plus className="size-4" />
                Registrar equipo
              </Button>
            </Link>
          </>
        }
      />

      {/* Resumen del inventario */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Server className="size-5" />}
          label="Equipos"
          value={String(equipos.length)}
          hint="activos registrados"
          tone="neutral"
        />
        <StatCard
          icon={<Building2 className="size-5" />}
          label="Empresas"
          value={String(new Set(equipos.map((e) => e.empresaId)).size)}
          hint="con equipos a cargo"
          tone="brand"
        />
        <StatCard
          icon={<FileText className="size-5" />}
          label="Revisiones"
          value={String(revisiones.length)}
          hint="registradas en total"
          tone="ok"
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          label="Requieren atención"
          value={String(atencion)}
          hint="en revisión o fuera de servicio"
          tone={atencion > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        {/* Columna principal */}
        <div className="space-y-4">
          {/* Filtros por estado */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFiltro(c.id)}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                  filtro === c.id
                    ? 'bg-ink-950 text-white'
                    : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50',
                )}
              >
                {c.dot && <span className={cx('size-1.5 rounded-full', c.dot)} />}
                {c.label}
                <span
                  className={cx('font-bold', filtro === c.id ? 'text-white' : 'text-zinc-900')}
                >
                  {c.n}
                </span>
              </button>
            ))}
          </div>

          {/* Panel por empresa (acordeón) */}
          {grupos.map(({ empresa, lista }) => {
            const abierta = abiertas[empresa.id] ?? true
            const porEstado = (est: EstadoEquipo) =>
              lista.filter((e) => e.estado === est).length

            return (
              <Card key={empresa.id} className="overflow-hidden">
                <div className="flex items-center gap-1 pr-3 sm:pr-4">
                  <button
                    type="button"
                    onClick={() => setAbiertas((a) => ({ ...a, [empresa.id]: !abierta }))}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 sm:px-5"
                  >
                    <ChevronDown
                      className={cx(
                        'size-4 shrink-0 text-zinc-400 transition-transform',
                        !abierta && '-rotate-90',
                      )}
                    />
                    <span className="truncate text-sm font-bold text-zinc-900">
                      {empresa.nombre}
                    </span>
                    <span className="hidden shrink-0 text-xs text-zinc-400 sm:block">
                      {lista.length} {lista.length === 1 ? 'equipo' : 'equipos'}
                    </span>
                    {/* Mini-conteo por estado */}
                    <span className="ml-1 flex shrink-0 items-center gap-2">
                      {(['fuera_servicio', 'mantenimiento', 'operativo'] as const).map(
                        (est) =>
                          porEstado(est) > 0 && (
                            <span
                              key={est}
                              className="flex items-center gap-1 text-xs font-bold text-zinc-700"
                              title={ESTADOS[est].label}
                            >
                              <span
                                className={cx('size-1.5 rounded-full', ESTADOS[est].dot)}
                              />
                              {porEstado(est)}
                            </span>
                          ),
                      )}
                    </span>
                  </button>
                  {!empresaFiltro && (
                    <Link
                      to={`/equipos?empresa=${empresa.id}`}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      Ver empresa →
                    </Link>
                  )}
                </div>

                {abierta && (
                  <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {lista.map((eq) => (
                      <EquipoRow
                        key={eq.id}
                        eq={eq}
                        nRevisiones={revisionesPorEquipo.get(eq.id) ?? 0}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )
          })}

          {grupos.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-sm font-semibold text-zinc-900">
                {cargando ? 'Cargando equipos…' : 'Sin resultados'}
              </p>
              {!cargando && (
                <p className="mt-1 text-sm text-zinc-500">
                  No hay equipos con los filtros aplicados.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Columna lateral: actividad */}
        <ActividadReciente revisiones={revisiones} equipos={equipos} />
      </div>
    </div>
  )
}
