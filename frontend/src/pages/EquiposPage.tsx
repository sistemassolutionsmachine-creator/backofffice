import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
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
  SearchInput,
  StatCard,
  TipoServicioBadge,
  cx,
} from '../components/ui'
import { useData } from '../store/DataContext'
import { EquipoCard, PESO_ESTADO as PESO } from '../components/EquipoCard'
import { Paginacion } from '../components/Paginacion'
import { Selector } from '../components/Selector'
import { api } from '../api/client'
import { fechaCorta } from '../utils/fechas'
import { nombreVisible } from '../types'
import type { Empresa, EstadoEquipo, Equipo, Revision } from '../types'

const ESTADOS: Record<
  EstadoEquipo,
  { label: string; dot: string; text: string }
> = {
  operativo: { label: 'Operativo', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-amber-500', text: 'text-amber-600' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-brand-600', text: 'text-brand-700' },
}

const POR_PAGINA = 25

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
                  {eq ? nombreVisible(eq) : 'Equipo'}
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
        {ultimas.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-zinc-500">
            Aún no hay revisiones registradas.
          </li>
        )}
      </ul>
    </Card>
  )
}

/** Tarjeta-resumen de una empresa en la vista general. */
function EmpresaCard({
  empresa,
  lista,
  indice,
}: {
  empresa: Empresa
  lista: Equipo[]
  indice: number
}) {
  const porEstado = (est: EstadoEquipo) => lista.filter((e) => e.estado === est).length
  const atencion = porEstado('fuera_servicio') + porEstado('mantenimiento')

  return (
    <Link
      to={`/equipos?empresa=${empresa.id}`}
      viewTransition
      className="anim-entrada block"
      style={{ animationDelay: `${Math.min(indice, 8) * 45}ms` }}
    >
      <Card
        className={cx(
          'group flex h-full flex-col p-4 transition-all duration-200 sm:p-5',
          'hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg',
          porEstado('fuera_servicio') > 0 &&
            'border-brand-300 ring-1 ring-brand-200 hover:border-brand-400',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className="min-w-0 text-sm leading-snug font-bold text-zinc-900 transition-colors group-hover:text-brand-700"
            style={{ viewTransitionName: `empresa-${empresa.id}` }}
          >
            {empresa.nombre}
          </p>
          <ChevronRight className="size-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {lista.length} {lista.length === 1 ? 'equipo' : 'equipos'}
          {atencion > 0 ? ` · ${atencion} requieren atención` : lista.length ? ' · todo operativo' : ' · listo para registrar'}
        </p>
        <div className="mt-4 flex items-center gap-4 border-t border-zinc-100 pt-3">
          {(['fuera_servicio', 'mantenimiento', 'operativo'] as const).map(
            (est) =>
              porEstado(est) > 0 && (
                <span
                  key={est}
                  className="flex items-center gap-1.5 text-sm font-bold text-zinc-800"
                  title={ESTADOS[est].label}
                >
                  <span className={cx('size-2 rounded-full', ESTADOS[est].dot)} />
                  {porEstado(est)}
                </span>
              ),
          )}
        </div>
      </Card>
    </Link>
  )
}

export function EquiposPage() {
  const { equipos, empresas, contratos, cargando, error, getEmpresa } = useData()
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = useState<EstadoEquipo | 'todos'>('todos')
  const [query, setQuery] = useState('')
  const [pagina, setPagina] = useState(0)
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const empresaFiltro = params.get('empresa') ?? ''
  const contratoFiltro = params.get('contrato') ?? ''
  const buscando = query.trim().length > 0

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

  // Cambiar de empresa, búsqueda o filtro vuelve a la primera página.
  useEffect(() => {
    setPagina(0)
  }, [empresaFiltro, contratoFiltro, query, filtro])

  const revisionesPorEquipo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of revisiones) {
      mapa.set(r.equipoId, (mapa.get(r.equipoId) ?? 0) + 1)
    }
    return mapa
  }, [revisiones])

  /* Búsqueda por cualquier dato de la ficha del equipo. */
  const coincide = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return () => true
    return (e: Equipo) =>
      [e.codigo, e.nombre, e.tipo, e.sistema, e.ubicacion, e.zona, e.marca, e.modelo, e.serial]
        .join(' ')
        .toLowerCase()
        .includes(q)
  }, [query])

  /** Equipos dentro del ámbito actual (empresa + búsqueda), sin filtro de estado. */
  const ambito = useMemo(
    () =>
      equipos
        .filter((e) => !empresaFiltro || e.empresaId === empresaFiltro)
        .filter((e) => !contratoFiltro || (contratoFiltro === 'pendientes' ? !e.contratoId : e.contratoId === contratoFiltro))
        .filter(coincide),
    [equipos, empresaFiltro, contratoFiltro, coincide],
  )

  /** Y con el filtro de estado aplicado, ordenado: lo que falla primero. */
  const resultado = useMemo(
    () =>
      ambito
        .filter((e) => filtro === 'todos' || e.estado === filtro)
        .sort(
          (a, b) =>
            PESO[a.estado] - PESO[b.estado] ||
            a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
        ),
    [ambito, filtro],
  )

  const conteos = {
    todos: ambito.length,
    operativo: ambito.filter((e) => e.estado === 'operativo').length,
    mantenimiento: ambito.filter((e) => e.estado === 'mantenimiento').length,
    fuera_servicio: ambito.filter((e) => e.estado === 'fuera_servicio').length,
  }

  /* Resumen por empresa para la vista general. */
  const grupos = useMemo(
    () =>
      empresas
        .map((empresa) => ({
          empresa,
          lista: equipos.filter((e) => e.empresaId === empresa.id),
        }))
        .sort(
          (a, b) =>
            Math.min(3, ...a.lista.map((e) => PESO[e.estado])) -
            Math.min(3, ...b.lista.map((e) => PESO[e.estado])),
        ),
    [empresas, equipos],
  )

  const totalPaginas = Math.max(1, Math.ceil(resultado.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const visibles = resultado.slice(
    paginaActual * POR_PAGINA,
    (paginaActual + 1) * POR_PAGINA,
  )

  const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
  const empresaSel = empresas.find((e) => e.id === empresaFiltro)
  const atencion = conteos.mantenimiento + conteos.fuera_servicio

  /* La lista de equipos solo aparece dentro de una empresa o al buscar. */
  const mostrarLista = Boolean(empresaFiltro) || Boolean(contratoFiltro) || buscando
  const contextoAlta = new URLSearchParams()
  if (empresaFiltro) contextoAlta.set('empresa', empresaFiltro)
  if (contratos.some((c) => c.id === contratoFiltro && c.estado === 'activo')) contextoAlta.set('contrato', contratoFiltro)

  const chips: Array<{ id: EstadoEquipo | 'todos'; label: string; n: number; dot?: string }> = [
    { id: 'todos', label: 'Todos', n: conteos.todos },
    { id: 'operativo', label: 'Operativos', n: conteos.operativo, dot: 'bg-emerald-500' },
    { id: 'mantenimiento', label: 'Mantenimiento', n: conteos.mantenimiento, dot: 'bg-amber-500' },
    { id: 'fuera_servicio', label: 'Fuera de servicio', n: conteos.fuera_servicio, dot: 'bg-brand-600' },
  ]

  return (
    <div className="space-y-5">
      {empresaSel && (
        <Link
          to="/equipos"
          viewTransition
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          Todas las empresas
        </Link>
      )}

      <PageHeader
        title={
          empresaSel ? (
            // Mismo nombre de transición que la tarjeta: el título "viaja"
            // de la cuadrícula al encabezado al entrar a la empresa.
            <span
              className="inline-block"
              style={{ viewTransitionName: `empresa-${empresaSel.id}` }}
            >
              {empresaSel.nombre}
            </span>
          ) : (
            'Equipos'
          )
        }
        subtitle={
          empresaSel
            ? `${conteos.todos} ${conteos.todos === 1 ? 'equipo' : 'equipos'} · ${hoy}`
            : `${equipos.length} equipos en ${grupos.length} empresas · ${hoy}`
        }
        actions={
          <>
            {empresaSel && <Link to={`/contratos?empresa=${empresaSel.id}`}><Button variant="secondary"><FileText className="size-4" /> Contratos</Button></Link>}
            <Link to={`/equipos/importar?${contextoAlta}`}>
              <Button variant="secondary">
                <Upload className="size-4" />
                Importar
              </Button>
            </Link>
            <Link to={`/equipos/nuevo?${contextoAlta}`}>
              <Button>
                <Plus className="size-4" />
                Registrar equipo
              </Button>
            </Link>
          </>
        }
      />

      {error && <p role="alert" className="rounded-xl bg-brand-50 p-4 text-sm text-brand-700">{error}</p>}
      {empresaSel && (
        <div className="block max-w-lg text-sm font-semibold text-zinc-700">
          <span className="mb-2 block">Contrato</span>
          <Selector
            ariaLabel="Filtrar por contrato"
            value={contratoFiltro}
            onChange={(v) => {
              const nuevos = new URLSearchParams(params)
              if (v) nuevos.set('contrato', v)
              else nuevos.delete('contrato')
              setParams(nuevos)
            }}
            opciones={[
              { valor: '', etiqueta: 'Todos los contratos' },
              ...contratos
                .filter((c) => c.empresaId === empresaSel.id)
                .map((c) => ({
                  valor: c.id,
                  etiqueta: `${c.codigo} · ${c.nombre}`,
                  detalle: c.estado === 'finalizado' ? 'Finalizado' : undefined,
                })),
              { valor: 'pendientes', etiqueta: 'Pendientes de contrato' },
            ]}
          />
        </div>
      )}

      {/* Resumen del inventario (solo en la vista general) */}
      {!empresaSel && (
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
            value={String(grupos.length)}
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
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        {/* Columna principal */}
        <div className="space-y-4">
          {/* Búsqueda */}
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={
              empresaSel
                ? `Buscar en ${empresaSel.nombre}…`
                : 'Buscar en todo el inventario: código, nombre, ubicación…'
            }
          />

          {/* Filtros por estado (solo cuando hay lista visible) */}
          {mostrarLista && (
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
          )}

          {/* Vista general: una tarjeta por empresa, sin equipos sueltos */}
          {!mostrarLista && (
            <div className="grid gap-3 sm:grid-cols-2">
              {grupos.map(({ empresa, lista }, i) => (
                <EmpresaCard
                  key={empresa.id}
                  empresa={empresa}
                  lista={lista}
                  indice={i}
                />
              ))}
              {grupos.length === 0 && (
                <Card className="p-10 text-center sm:col-span-2">
                  <p className="text-sm font-semibold text-zinc-900">
                    {cargando ? 'Cargando equipos…' : 'Sin equipos registrados'}
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Cuadrícula paginada: dentro de una empresa o al buscar */}
          {mostrarLista && (
            <>
              <Paginacion
                pagina={paginaActual}
                total={resultado.length}
                porPagina={POR_PAGINA}
                onCambiar={setPagina}
              />

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {visibles.map((eq, i) => (
                  <EquipoCard
                    key={eq.id}
                    eq={eq}
                    to={`/equipos/${eq.id}`}
                    indice={i}
                    contratoNombre={contratos.find((c) => c.id === eq.contratoId)?.codigo}
                    nRevisiones={revisionesPorEquipo.get(eq.id) ?? 0}
                    empresaNombre={
                      !empresaFiltro ? getEmpresa(eq.empresaId)?.nombre : undefined
                    }
                  />
                ))}
              </div>

              {resultado.length === 0 && (
                <Card className="p-10 text-center">
                  <p className="text-sm text-zinc-500">
                    No hay equipos que coincidan con la búsqueda.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Columna lateral: actividad */}
        <ActividadReciente revisiones={revisiones} equipos={equipos} />
      </div>
    </div>
  )
}
