import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  Camera,
  CheckCircle2,
  Download,
  FileText,
  History,
  LogOut,
  MapPin,
  PenLine,
  Server,
} from 'lucide-react'
import {
  Button,
  Card,
  EstadoEquipoBadge,
  EstadoRevisionBadge,
  StatCard,
  TipoServicioBadge,
  cx,
} from '../../components/ui'
import { FirmaModal } from '../../components/FirmaModal'
import { api } from '../../api/client'
import { formatFecha } from '../../utils/fechas'
import { cerrarSesion, getUsuario } from '../../utils/auth'
import { ESTILOS_FIRMA, type EstiloFirma } from '../../utils/firma'
import { generarReportePdf } from '../../utils/reportePdf'
import { nombreVisible } from '../../types'
import type { Empresa, Equipo, Revision } from '../../types'

export function ClientePortalPage() {
  const navigate = useNavigate()
  const usuario = getUsuario()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Reporte sobre el que se está actuando (firmar o descargar). */
  const [firmando, setFirmando] = useState<Revision | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = async () => {
    try {
      // El servidor ya acota cada respuesta a la empresa del cliente.
      const [empresas, eq, rev] = await Promise.all([
        api.empresas.listar(),
        api.equipos.listar(),
        api.revisiones.listar(),
      ])
      setEmpresa(empresas[0] ?? null)
      setEquipos(eq)
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

  if (usuario?.rol !== 'cliente') return <Navigate to="/login" replace />

  const entregados = revisiones.filter((r) => r.estado === 'completado')
  const pendientesFirma = entregados.filter((r) => !r.firmaCliente)

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const nombreDelEquipo = (equipoId: string) => {
    const eq = equipos.find((e) => e.id === equipoId)
    return eq ? nombreVisible(eq) : 'Equipo'
  }

  /* ---------- Reconstrucción del PDF ---------- */

  /**
   * Rehace el documento con los datos actuales del reporte.
   *
   * El PDF se archiva cuando el técnico cierra la visita, es decir, antes de
   * que el cliente firme. Al firmar hay que volver a generarlo para que el
   * documento refleje las dos firmas.
   */
  const construirPdf = async (revision: Revision, descargar: boolean) => {
    const detalle = await api.revisiones.obtener(revision.equipoId, revision.id)
    const eq = equipos.find((e) => e.id === revision.equipoId)

    const fuente = (estilo?: string) =>
      ESTILOS_FIRMA[(estilo as EstiloFirma) ?? 'clasica']?.font ??
      ESTILOS_FIRMA.clasica.font

    return generarReportePdf(
      {
        consecutivo: detalle.consecutivo,
        motivo: detalle.motivo,
        equipo: eq && {
          codigo: eq.codigo,
          nombre: nombreVisible(eq),
          modelo: eq.modelo,
          serial: eq.serial,
          ubicacion: eq.ubicacion,
        },
        tipoEquipo: detalle.tipoEquipo,
        inspeccionVisual: detalle.inspeccionVisual,
        rutina: detalle.rutina,
        medicionesMecanicas: detalle.medicionesMecanicas,
        medicionesElectricas: detalle.medicionesElectricas,
        monitoreo: detalle.monitoreo,
        analisis: detalle.analisis,
        correctivos: detalle.correctivos,
        observaciones: detalle.observaciones,
        // Las evidencias se leen de S3 con enlaces temporales.
        fotosEntrada: detalle.urls.fotosEntrada,
        fotosSalida: detalle.urls.fotosSalida,
        firma: detalle.firmaTecnico && {
          nombre: detalle.firmaTecnico.nombre,
          font: fuente(detalle.firmaTecnico.estilo),
          fecha: detalle.firmaTecnico.fecha,
        },
        firmaCliente: detalle.firmaCliente && {
          nombre: detalle.firmaCliente.nombre,
          cargo: detalle.firmaCliente.cargo,
          font: fuente(detalle.firmaCliente.estilo),
          fecha: detalle.firmaCliente.fecha,
        },
      },
      { descargar },
    )
  }

  const descargarPdf = async (revision: Revision) => {
    setOcupado(revision.id)
    setAviso(null)
    setError(null)
    try {
      await construirPdf(revision, true)
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
      const pdf = await construirPdf(firmada, false)
      await api.revisiones.subirPdf(revision.equipoId, revision.id, pdf)

      setAviso(`Reporte ${firmada.consecutivo} firmado correctamente.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la firma')
      await cargar()
    } finally {
      setOcupado(null)
    }
  }

  /* ---------- Tarjeta de un reporte ---------- */
  const TarjetaReporte = ({ r, destacado }: { r: Revision; destacado?: boolean }) => (
    <div
      className={cx('px-4 py-3.5 sm:px-5', destacado && 'bg-amber-50/60')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-zinc-900">
          {r.consecutivo}
        </span>
        <span className="text-xs text-zinc-500">{formatFecha(r.fecha)}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-zinc-800">
        {nombreDelEquipo(r.equipoId)}
      </p>
      {r.observaciones && (
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{r.observaciones}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <TipoServicioBadge tipo={r.tipo} />
        <EstadoRevisionBadge estado={r.estado} />
        <span className="text-xs text-zinc-500">{r.tecnico}</span>
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <Camera className="size-3.5" />
          {r.fotosEntrada.length + r.fotosSalida.length}
        </span>
        {r.firmaCliente && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="size-3.5" />
            Firmado
          </span>
        )}
      </div>

      {r.estado === 'completado' && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {!r.firmaCliente && (
            <Button
              className="sm:w-auto"
              disabled={ocupado === r.id}
              onClick={() => setFirmando(r)}
            >
              <PenLine className="size-4" />
              {ocupado === r.id ? 'Procesando…' : 'Firmar recepción'}
            </Button>
          )}
          <Button
            variant="secondary"
            className="sm:w-auto"
            disabled={ocupado === r.id}
            onClick={() => void descargarPdf(r)}
          >
            <Download className="size-4" />
            {ocupado === r.id ? 'Generando…' : 'Descargar PDF'}
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-dvh bg-zinc-100">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.png"
              alt="Solutions Machine"
              className="size-9 shrink-0 object-contain"
            />
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

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pt-5 pb-10 sm:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
            {empresa?.nombre ?? usuario.nombre}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Inventario de sus equipos y trazabilidad completa de los servicios
            realizados.
          </p>
        </div>

        {error && (
          <Card className="border-brand-200 bg-brand-50 p-4">
            <p className="text-sm font-semibold text-brand-700">{error}</p>
          </Card>
        )}
        {aviso && (
          <Card className="border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">{aviso}</p>
          </Card>
        )}

        {cargando ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-zinc-500">Cargando su información…</p>
          </Card>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Server className="size-5" />}
                label="Equipos"
                value={String(equipos.length)}
                tone="neutral"
              />
              <StatCard
                icon={<FileText className="size-5" />}
                label="Revisiones"
                value={String(revisiones.length)}
                tone="brand"
              />
              <StatCard
                icon={<PenLine className="size-5" />}
                label="Por firmar"
                value={String(pendientesFirma.length)}
                tone={pendientesFirma.length > 0 ? 'warn' : 'ok'}
              />
            </div>

            {/* Pendientes de firma */}
            {pendientesFirma.length > 0 && (
              <Card className="overflow-hidden border-amber-200">
                <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3.5 sm:px-5">
                  <PenLine className="size-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-amber-900">
                    Pendientes de su firma
                  </h2>
                  <span className="ml-auto rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
                    {pendientesFirma.length}
                  </span>
                </div>
                <p className="border-b border-zinc-100 px-4 py-2.5 text-xs text-zinc-500 sm:px-5">
                  Al firmar deja constancia de que recibió el servicio. El documento
                  se archiva con su firma y la del técnico.
                </p>
                <div className="divide-y divide-zinc-100">
                  {pendientesFirma.map((r) => (
                    <TarjetaReporte key={r.id} r={r} destacado />
                  ))}
                </div>
              </Card>
            )}

            {/* Inventario */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
                <Server className="size-4 text-zinc-500" />
                <h2 className="text-sm font-bold text-zinc-900">Mi inventario</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {equipos.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">
                        <span className="mr-2 font-mono text-xs font-semibold text-zinc-500">
                          {eq.codigo}
                        </span>
                        {nombreVisible(eq)}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                        <MapPin className="size-3" />
                        {eq.ubicacion}
                        <span className="hidden sm:inline">
                          · Última revisión: {formatFecha(eq.ultimaRevision)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0">
                      <EstadoEquipoBadge estado={eq.estado} />
                    </span>
                  </div>
                ))}
                {equipos.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-zinc-500">
                    Aún no hay equipos registrados para su empresa.
                  </p>
                )}
              </div>
            </Card>

            {/* Historial */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3.5 sm:px-5">
                <History className="size-4 text-zinc-500" />
                <h2 className="text-sm font-bold text-zinc-900">
                  Historial de revisiones
                </h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {revisiones.map((r) => (
                  <TarjetaReporte key={r.id} r={r} />
                ))}
                {revisiones.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-zinc-500">
                    Aún no hay revisiones registradas para sus equipos.
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </main>

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
