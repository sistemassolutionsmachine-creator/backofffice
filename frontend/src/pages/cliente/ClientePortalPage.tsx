import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  History,
  LoaderCircle,
  LogOut,
  MapPin,
  PenLine,
  Server,
  ShieldCheck,
} from 'lucide-react'
import {
  Button,
  Card,
  EstadoEquipoBadge,
  EstadoEquipoPunto,
  SearchInput,
  TipoServicioBadge,
  cx,
} from '../../components/ui'
import { FirmaModal } from '../../components/FirmaModal'
import { Modal } from '../../components/Modal'
import { EquipoCard, PESO_ESTADO } from '../../components/EquipoCard'
import { Paginacion } from '../../components/Paginacion'
import { api } from '../../api/client'
import { formatFecha } from '../../utils/fechas'
import { cerrarSesion, getUsuario } from '../../utils/auth'
import { archivarReporte, descargarReporte } from '../../utils/reporteArchivado'
import { nombreVisible } from '../../types'
import type { Contrato, Empresa, EstadoEquipo, Equipo, Revision } from '../../types'

const EQUIPOS_POR_PAGINA = 12
const REPORTES_POR_PAGINA = 10

type Pestana = 'inventario' | 'historial'

export function ClientePortalPage() {
  const navigate = useNavigate()
  const usuario = getUsuario()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Reporte sobre el que se está actuando (firmar o descargar). */
  const [firmando, setFirmando] = useState<Revision | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [pestana, setPestana] = useState<Pestana>('inventario')
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<EstadoEquipo | 'todos'>('todos')
  const [contratoFiltro, setContratoFiltro] = useState('')
  const [pagina, setPagina] = useState(0)
  const [paginaReportes, setPaginaReportes] = useState(0)
  const [equipoAbierto, setEquipoAbierto] = useState<Equipo | null>(null)

  const cargar = async () => {
    try {
      // El servidor ya acota cada respuesta a la empresa del cliente.
      const [empresas, eq, rev, ct] = await Promise.all([
        api.empresas.listar(),
        api.equipos.listar(),
        api.revisiones.listar(),
        api.contratos.listar(),
      ])
      setEmpresa(empresas[0] ?? null)
      setEquipos(eq)
      setContratos(ct)
      setRevisiones(rev)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar sus datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cambiar búsqueda o filtros vuelve a la primera página.
  useEffect(() => {
    setPagina(0)
  }, [query, filtro, contratoFiltro])

  const revisionesPorEquipo = useMemo(() => {
    const mapa = new Map<string, Revision[]>()
    for (const r of revisiones) mapa.set(r.equipoId, [...(mapa.get(r.equipoId) ?? []), r])
    return mapa
  }, [revisiones])

  /** Equipos de la búsqueda y del contrato, sin filtro de estado (para los conteos). */
  const ambito = useMemo(() => {
    const q = query.trim().toLowerCase()
    return equipos
      .filter((e) => !contratoFiltro || e.contratoId === contratoFiltro)
      .filter(
        (e) =>
          !q ||
          [e.codigo, e.nombre, e.tipo, e.sistema, e.ubicacion, e.zona, e.marca, e.modelo, e.serial]
            .join(' ')
            .toLowerCase()
            .includes(q),
      )
  }, [equipos, query, contratoFiltro])

  const resultado = useMemo(
    () =>
      ambito
        .filter((e) => filtro === 'todos' || e.estado === filtro)
        .sort(
          (a, b) =>
            PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado] ||
            a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
        ),
    [ambito, filtro],
  )

  if (usuario?.rol !== 'cliente') return <Navigate to="/login" replace />

  const entregados = revisiones.filter((r) => r.estado === 'completado')
  const pendientesFirma = entregados.filter((r) => !r.firmaCliente)
  const cuenta = (est: EstadoEquipo, lista = equipos) => lista.filter((e) => e.estado === est).length
  const atencion = cuenta('mantenimiento') + cuenta('fuera_servicio')

  const paginaActual = Math.min(pagina, Math.max(0, Math.ceil(resultado.length / EQUIPOS_POR_PAGINA) - 1))
  const visibles = resultado.slice(paginaActual * EQUIPOS_POR_PAGINA, (paginaActual + 1) * EQUIPOS_POR_PAGINA)
  const reportesVisibles = revisiones.slice(
    paginaReportes * REPORTES_POR_PAGINA,
    (paginaReportes + 1) * REPORTES_POR_PAGINA,
  )

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const nombreDelEquipo = (equipoId: string) => {
    const eq = equipos.find((e) => e.id === equipoId)
    return eq ? nombreVisible(eq) : 'Equipo'
  }
  const codigoContrato = (id: string | null) => contratos.find((c) => c.id === id)?.codigo

  const descargarPdf = async (revision: Revision) => {
    setOcupado(revision.id)
    setAviso(null)
    setError(null)
    try {
      const actual = await descargarReporte(revision)
      setRevisiones((rs) => rs.map((r) => (r.id === actual.id ? actual : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setOcupado(null)
    }
  }

  /** Registra la firma y deja archivado el PDF con ambas firmas. */
  const confirmarFirma = async (nombre: string, cargo: string, estilo: string) => {
    if (!firmando) return
    const revision = firmando
    setFirmando(null)
    setOcupado(revision.id)
    setError(null)
    try {
      const firmada = await api.revisiones.firmar(revision.equipoId, revision.id, {
        nombre,
        cargo,
        estilo,
      })
      setRevisiones((rs) => rs.map((r) => (r.id === firmada.id ? firmada : r)))

      // Se rehace el documento para que quede con las dos firmas.
      const archivada = await archivarReporte(revision.equipoId, revision.id)
      setRevisiones((rs) => rs.map((r) => (r.id === archivada.id ? archivada : r)))

      setAviso(`Reporte ${firmada.consecutivo} firmado. El PDF ya incluye ambas firmas.`)
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : 'No se pudo completar el proceso'}. Si la firma ya aparece registrada, pulse Descargar PDF para reintentar el archivado actualizado.`,
      )
      await cargar()
    } finally {
      setOcupado(null)
    }
  }

  /* ---------- Acciones de un reporte ---------- */
  const Acciones = ({ r }: { r: Revision }) =>
    r.estado !== 'completado' ? null : (
      <div className="flex flex-wrap gap-2">
        {!r.firmaCliente && (
          <Button className="px-3 py-2 text-xs" disabled={ocupado === r.id} onClick={() => setFirmando(r)}>
            <PenLine className="size-3.5" />
            Firmar recepción
          </Button>
        )}
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs"
          disabled={ocupado === r.id}
          onClick={() => void descargarPdf(r)}
        >
          {ocupado === r.id ? (
            <LoaderCircle className="size-3.5 motion-safe:animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          {ocupado === r.id ? 'Preparando…' : 'Descargar PDF'}
        </Button>
      </div>
    )

  /** Fila de un reporte: historial general y ficha del equipo. */
  const FilaReporte = ({ r, conEquipo = true }: { r: Revision; conEquipo?: boolean }) => (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-mono text-xs font-bold text-zinc-900">{r.consecutivo}</span>
          <TipoServicioBadge tipo={r.tipo} />
          {r.firmaCliente ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              Firmado
            </span>
          ) : (
            r.estado === 'completado' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                <PenLine className="size-3.5" />
                Por firmar
              </span>
            )
          )}
        </div>
        {conEquipo && (
          <p className="mt-1.5 truncate text-sm font-semibold text-zinc-900">{nombreDelEquipo(r.equipoId)}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{formatFecha(r.fecha)}</span>
          <span>{r.tecnico}</span>
          <EstadoEquipoPunto estado={r.estadoEquipo} />
        </div>
        {r.observaciones && <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500">{r.observaciones}</p>}
      </div>
      <div className="shrink-0">
        <Acciones r={r} />
      </div>
    </div>
  )

  const chips: Array<{ id: EstadoEquipo | 'todos'; label: string; n: number; dot?: string }> = [
    { id: 'todos', label: 'Todos', n: ambito.length },
    { id: 'operativo', label: 'Operativos', n: cuenta('operativo', ambito), dot: 'bg-emerald-500' },
    { id: 'mantenimiento', label: 'Mantenimiento', n: cuenta('mantenimiento', ambito), dot: 'bg-amber-500' },
    { id: 'fuera_servicio', label: 'Fuera de servicio', n: cuenta('fuera_servicio', ambito), dot: 'bg-brand-600' },
  ]

  return (
    <div className="min-h-dvh bg-zinc-100">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/icon.png" alt="Solutions Machine" className="size-9 shrink-0 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-zinc-900">Solutions Machine</p>
              <p className="text-[10px] font-semibold tracking-wide text-brand-600 uppercase">
                Portal del cliente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={salir}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-5 pb-12 sm:px-6">
        {/* Portada con el resumen de la empresa */}
        <section className="anim-entrada relative overflow-hidden rounded-3xl bg-ink-950 px-5 py-6 text-white shadow-xl sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-brand-600/10 blur-3xl" />
          <img
            src="/icon.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -bottom-12 w-56 rotate-12 opacity-[0.07] select-none"
          />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
              <Building2 className="size-3.5" />
              Bienvenido, {usuario.nombre.split(' ')[0]}
            </p>
            <h1 className="mt-2 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
              {empresa?.nombre ?? 'Su empresa'}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-zinc-400">
              Inventario de sus equipos y trazabilidad completa de cada servicio realizado.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { icono: Server, etiqueta: 'Equipos', valor: equipos.length, tono: 'text-white' },
                { icono: ShieldCheck, etiqueta: 'Operativos', valor: cuenta('operativo'), tono: 'text-emerald-400' },
                {
                  icono: AlertTriangle,
                  etiqueta: 'Requieren atención',
                  valor: atencion,
                  tono: atencion > 0 ? 'text-amber-400' : 'text-white',
                },
                {
                  icono: PenLine,
                  etiqueta: 'Por firmar',
                  valor: pendientesFirma.length,
                  tono: pendientesFirma.length > 0 ? 'text-brand-400' : 'text-white',
                },
              ].map(({ icono: Icono, etiqueta, valor, tono }) => (
                <div key={etiqueta} className="rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-white/10">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                    <Icono className="size-3.5" />
                    {etiqueta}
                  </p>
                  <p className={cx('mt-1 text-2xl font-bold tabular-nums', tono)}>
                    {cargando ? '—' : valor}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <Card className="border-brand-200 bg-brand-50 p-4">
            <p role="alert" className="text-sm font-semibold text-brand-700">{error}</p>
          </Card>
        )}
        {aviso && (
          <Card className="border-emerald-200 bg-emerald-50 p-4">
            <p role="status" className="text-sm font-semibold text-emerald-800">{aviso}</p>
          </Card>
        )}

        {cargando ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando su información">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
            ))}
          </div>
        ) : (
          <>
            {/* Pendientes de firma */}
            {pendientesFirma.length > 0 && (
              <section className="anim-entrada">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <PenLine className="size-4" />
                  </span>
                  <h2 className="text-base font-bold text-zinc-900">Pendientes de su firma</h2>
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                    {pendientesFirma.length}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendientesFirma.map((r) => (
                    <Card key={r.id} className="flex flex-col border-amber-200 p-4 ring-1 ring-amber-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-900">{r.consecutivo}</span>
                        <span className="text-xs text-zinc-500">{formatFecha(r.fecha)}</span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-zinc-900">{nombreDelEquipo(r.equipoId)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <TipoServicioBadge tipo={r.tipo} />
                        <span className="text-xs text-zinc-500">{r.tecnico}</span>
                        <EstadoEquipoPunto estado={r.estadoEquipo} />
                      </div>
                      <p className="mt-3 mb-4 text-xs text-zinc-500">
                        Al firmar deja constancia de que recibió el servicio. El PDF se archiva con su
                        firma y la del técnico.
                      </p>
                      <div className="mt-auto">
                        <Acciones r={r} />
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Pestañas */}
            <div
              role="tablist"
              aria-label="Secciones del portal"
              className="inline-flex rounded-2xl bg-white p-1 shadow-sm ring-1 ring-zinc-200"
            >
              {(
                [
                  { id: 'inventario', label: 'Mi inventario', icono: Server, n: equipos.length },
                  { id: 'historial', label: 'Historial de servicios', icono: History, n: revisiones.length },
                ] as const
              ).map(({ id, label, icono: Icono, n }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === id}
                  onClick={() => setPestana(id)}
                  className={cx(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors sm:px-4',
                    pestana === id ? 'bg-ink-950 text-white shadow' : 'text-zinc-600 hover:text-zinc-900',
                  )}
                >
                  <Icono className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{id === 'inventario' ? 'Inventario' : 'Historial'}</span>
                  <span
                    className={cx(
                      'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                      pestana === id ? 'bg-white/15' : 'bg-zinc-100 text-zinc-500',
                    )}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </div>

            {pestana === 'inventario' ? (
              <section className="space-y-4" aria-label="Mi inventario">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="lg:flex-1">
                    <SearchInput
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar por código, nombre, ubicación, marca…"
                    />
                  </div>
                  {contratos.length > 1 && (
                    <select
                      aria-label="Filtrar por contrato"
                      value={contratoFiltro}
                      onChange={(e) => setContratoFiltro(e.target.value)}
                      className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-700 lg:w-72"
                    >
                      <option value="">Todos los contratos</option>
                      {contratos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} · {c.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {chips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFiltro(c.id)}
                      aria-pressed={filtro === c.id}
                      className={cx(
                        'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                        filtro === c.id
                          ? 'bg-ink-950 text-white'
                          : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50',
                      )}
                    >
                      {c.dot && <span className={cx('size-1.5 rounded-full', c.dot)} />}
                      {c.label}
                      <span className={cx('font-bold', filtro === c.id ? 'text-white' : 'text-zinc-900')}>
                        {c.n}
                      </span>
                    </button>
                  ))}
                </div>

                <Paginacion
                  pagina={paginaActual}
                  total={resultado.length}
                  porPagina={EQUIPOS_POR_PAGINA}
                  onCambiar={(p) => {
                    setPagina(p)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />

                {/* `key` reinicia la animación de entrada al cambiar de página. */}
                <div key={`${paginaActual}-${filtro}-${query}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibles.map((eq, i) => (
                    <EquipoCard
                      key={eq.id}
                      eq={eq}
                      indice={i}
                      nRevisiones={revisionesPorEquipo.get(eq.id)?.length ?? 0}
                      contratoNombre={codigoContrato(eq.contratoId)}
                      onClick={() => setEquipoAbierto(eq)}
                    />
                  ))}
                </div>

                {resultado.length === 0 && (
                  <Card className="p-10 text-center">
                    <p className="text-sm font-semibold text-zinc-900">
                      {equipos.length === 0 ? 'Aún no hay equipos registrados' : 'Sin resultados'}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {equipos.length === 0
                        ? 'Cuando registremos los equipos de su empresa aparecerán aquí.'
                        : 'No hay equipos que coincidan con la búsqueda o el filtro.'}
                    </p>
                  </Card>
                )}

                {resultado.length > EQUIPOS_POR_PAGINA && (
                  <Paginacion
                    pagina={paginaActual}
                    total={resultado.length}
                    porPagina={EQUIPOS_POR_PAGINA}
                    onCambiar={(p) => {
                      setPagina(p)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                )}
              </section>
            ) : (
              <section className="space-y-4" aria-label="Historial de servicios">
                <Paginacion
                  pagina={paginaReportes}
                  total={revisiones.length}
                  porPagina={REPORTES_POR_PAGINA}
                  onCambiar={setPaginaReportes}
                  sustantivo="servicios"
                />
                <Card className="divide-y divide-zinc-100 overflow-hidden">
                  {reportesVisibles.map((r) => (
                    <FilaReporte key={r.id} r={r} />
                  ))}
                  {revisiones.length === 0 && (
                    <p className="px-5 py-10 text-center text-sm text-zinc-500">
                      Aún no hay servicios registrados para sus equipos.
                    </p>
                  )}
                </Card>
              </section>
            )}
          </>
        )}
      </main>

      {/* Ficha del equipo */}
      {equipoAbierto && !firmando && (
        <FichaEquipo
          eq={equipoAbierto}
          contrato={contratos.find((c) => c.id === equipoAbierto.contratoId)}
          historial={revisionesPorEquipo.get(equipoAbierto.id) ?? []}
          FilaReporte={FilaReporte}
          onCerrar={() => setEquipoAbierto(null)}
        />
      )}

      {firmando && (
        <FirmaModal
          titulo="Firmar recepción del servicio"
          descripcion={`Reporte ${firmando.consecutivo} · ${nombreDelEquipo(firmando.equipoId)}`}
          pedirCargo
          nombreInicial={usuario.nombre}
          textoBoton="Firmar el reporte"
          onCerrar={() => setFirmando(null)}
          onGuardar={(f) => void confirmarFirma(f.nombre, f.cargo ?? '', f.estilo)}
        />
      )}
    </div>
  )
}

/** Ficha del equipo en un panel: datos técnicos y su historial de servicios. */
function FichaEquipo({
  eq,
  contrato,
  historial,
  FilaReporte,
  onCerrar,
}: {
  eq: Equipo
  contrato?: Contrato
  historial: Revision[]
  FilaReporte: (p: { r: Revision; conEquipo?: boolean }) => ReactNode
  onCerrar: () => void
}) {
  // Solo se muestran los datos con contenido: la ficha varía según el tipo de equipo.
  const datos = (
    [
      ['Sistema', eq.sistema],
      ['Tipo', eq.tipo],
      ['Serial', eq.serial],
      ['Zona', eq.zona],
      ['Marca', eq.marca],
      ['Modelo', eq.modelo],
      ['Caudal', eq.caudal],
      ['Capacidad', eq.capacidad],
      ['Tensión', eq.tension],
      ['Corriente', eq.corriente],
    ] as Array<[string, string]>
  ).filter(([, v]) => v)

  return (
    <Modal
      titulo={nombreVisible(eq)}
      ancho="lg"
      onCerrar={onCerrar}
      encabezado={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs font-bold text-zinc-700">
            {eq.codigo}
          </span>
          <EstadoEquipoBadge estado={eq.estado} />
        </div>
      }
    >
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" />
          {eq.ubicacion}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="size-3.5" />
          {contrato ? `${contrato.codigo} · ${contrato.nombre}` : 'Pendiente de contrato'}
        </span>
      </p>

      {datos.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl bg-zinc-50 p-4 sm:grid-cols-3">
          {datos.map(([label, valor]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</dt>
              <dd className="mt-0.5 text-sm font-semibold break-words text-zinc-900">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <History className="size-4 text-zinc-500" />
          Historial de servicios
          <span className="rounded-full bg-zinc-100 px-2 text-xs text-zinc-500">{historial.length}</span>
        </h3>
        <div className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200">
          {historial.map((r) => (
            <FilaReporte key={r.id} r={r} conEquipo={false} />
          ))}
          {historial.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Este equipo aún no tiene servicios registrados.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
