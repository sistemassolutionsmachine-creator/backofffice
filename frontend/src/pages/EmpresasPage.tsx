import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Download,
  MapPin,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Server,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { Button, Card, PageHeader, cx } from '../components/ui'
import { useData } from '../store/DataContext'
import { descargarEtiquetasDeEmpresa } from '../utils/qr'
import type { Empresa, Equipo } from '../types'

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

const colores = [
  'bg-brand-600',
  'bg-ink-900',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
]

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function EmpresaModal({
  inicial,
  onClose,
  onSave,
}: {
  inicial: Empresa | null
  onClose: () => void
  onSave: (data: Omit<Empresa, 'id'>) => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [nit, setNit] = useState(inicial?.nit ?? '')
  const [contacto, setContacto] = useState(inicial?.contacto ?? '')
  const [telefono, setTelefono] = useState(inicial?.telefono ?? '')
  const [ciudad, setCiudad] = useState(inicial?.ciudad ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {inicial ? 'Editar empresa' : 'Nueva empresa / proyecto'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Los equipos registrados se asignan a una empresa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nombre *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Clínica Santa María"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">NIT</label>
              <input
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                placeholder="900.000.000-1"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Ciudad
              </label>
              <input
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Bogotá"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Persona de contacto
            </label>
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Nombre del contacto"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Teléfono
            </label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+57 300 000 0000"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!nombre.trim()}
            onClick={() =>
              onSave({
                nombre: nombre.trim(),
                nit: nit.trim() || '—',
                contacto: contacto.trim() || '—',
                telefono: telefono.trim() || '—',
                ciudad: ciudad.trim() || '—',
              })
            }
          >
            {inicial ? 'Guardar cambios' : 'Crear empresa'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function EmpresasPage() {
  const { empresas, equiposDeEmpresa, addEmpresa, updateEmpresa, removeEmpresa } =
    useData()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<'crear' | Empresa | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<string | null>(null)

  // Permite llegar con /empresas?nueva=1 desde "Registrar equipo"
  useEffect(() => {
    if (params.get('nueva') === '1') {
      setModal('crear')
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  /**
   * Genera todas las etiquetas de la empresa y las entrega en un único
   * archivo comprimido, con una carpeta por empresa.
   */
  const descargarQrs = async (empresa: Empresa, equipos: Equipo[]) => {
    setDescargando(empresa.id)
    setProgreso(null)
    setError(null)
    try {
      await descargarEtiquetasDeEmpresa(empresa, equipos, (hechos, total) => {
        setProgreso(`Generando ${hechos} de ${total}…`)
      })
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron generar los códigos QR',
      )
    } finally {
      setDescargando(null)
      setProgreso(null)
    }
  }

  const eliminar = async (empresa: Empresa) => {
    if (!confirm(`¿Eliminar "${empresa.nombre}"?`)) return
    try {
      await removeEmpresa(empresa.id)
      setError(null)
    } catch (e) {
      // El servidor rechaza el borrado si la empresa todavía tiene equipos.
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la empresa')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Empresas y proyectos"
        subtitle="Cada equipo del inventario pertenece a una empresa o proyecto"
        actions={
          <Button onClick={() => setModal('crear')}>
            <Plus className="size-4" />
            Nueva empresa
          </Button>
        }
      />

      {error && (
        <Card className="border-brand-200 bg-brand-50 p-4 text-sm font-medium text-brand-800">
          {error}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {empresas.map((em, i) => {
          const equipos = equiposDeEmpresa(em.id)
          return (
            <Card key={em.id} className="flex flex-col p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white',
                    colores[i % colores.length],
                  )}
                >
                  {iniciales(em.nombre) || <Building2 className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-900">{em.nombre}</p>
                  <p className="text-xs text-zinc-500">NIT {em.nit}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    title={
                      equipos.length
                        ? `Descargar los ${equipos.length} códigos QR`
                        : 'Esta empresa no tiene equipos'
                    }
                    disabled={equipos.length === 0 || descargando === em.id}
                    onClick={() => void descargarQrs(em, equipos)}
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <QrCode className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => setModal(em)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => void eliminar(em)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-zinc-600">
                <p className="flex items-center gap-2">
                  <User className="size-3.5 text-zinc-400" /> {em.contacto}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-zinc-400" /> {em.telefono}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-zinc-400" /> {em.ciudad}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                  <Server className="size-4 text-zinc-400" />
                  {equipos.length} {equipos.length === 1 ? 'equipo' : 'equipos'}
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/equipos?empresa=${em.id}`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Ver equipos
                  </Link>
                  <Link
                    to={`/equipos/nuevo?empresa=${em.id}`}
                    className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                  >
                    + Registrar
                  </Link>
                </div>
              </div>

              {equipos.length > 0 && (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={descargando === em.id}
                  onClick={() => void descargarQrs(em, equipos)}
                >
                  <Download className="size-4" />
                  {descargando === em.id
                    ? (progreso ?? 'Preparando…')
                    : `Descargar ${equipos.length} códigos QR`}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      {modal && (
        <EmpresaModal
          inicial={modal === 'crear' ? null : modal}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            try {
              if (modal === 'crear') await addEmpresa(data)
              else await updateEmpresa(modal.id, data)
              setModal(null)
              setError(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo guardar la empresa')
            }
          }}
        />
      )}
    </div>
  )
}
