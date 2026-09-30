import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Camera, FileText, History, LogOut, MapPin, Server } from 'lucide-react'
import {
  Card,
  EstadoEquipoBadge,
  EstadoRevisionBadge,
  StatCard,
  TipoServicioBadge,
} from '../../components/ui'
import { api } from '../../api/client'
import { formatFecha } from '../../utils/fechas'
import { cerrarSesion, getUsuario } from '../../utils/auth'
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

  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      try {
        // El servidor ya acota cada respuesta a la empresa del cliente.
        const [empresas, eq, rev] = await Promise.all([
          api.empresas.listar(),
          api.equipos.listar(),
          api.revisiones.listar(),
        ])
        if (!vigente) return
        setEmpresa(empresas[0] ?? null)
        setEquipos(eq)
        setRevisiones(rev)
      } catch (e) {
        if (vigente) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar sus datos')
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }
    void cargar()
    return () => {
      vigente = false
    }
  }, [])

  if (usuario?.rol !== 'cliente') return <Navigate to="/login" replace />

  const operativos = equipos.filter((e) => e.estado === 'operativo').length

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

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
                icon={<History className="size-5" />}
                label="Operativos"
                value={`${operativos}/${equipos.length}`}
                tone={operativos === equipos.length ? 'ok' : 'warn'}
              />
            </div>

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
                {revisiones.map((r) => {
                  const eq = equipos.find((e) => e.id === r.equipoId)
                  return (
                    <div key={r.id} className="px-4 py-3.5 sm:px-5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-900">
                          {r.consecutivo}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatFecha(r.fecha)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-zinc-800">
                        {eq ? nombreVisible(eq) : "Equipo"}
                      </p>
                      {r.observaciones && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                          {r.observaciones}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <TipoServicioBadge tipo={r.tipo} />
                        <EstadoRevisionBadge estado={r.estado} />
                        <span className="text-xs text-zinc-500">{r.tecnico}</span>
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Camera className="size-3.5" />
                          {r.fotosEntrada.length + r.fotosSalida.length}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
    </div>
  )
}
