import { useMemo, useState } from 'react'
import {
  Building2,
  KeyRound,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  Avatar,
  Button,
  Card,
  PageHeader,
  RolBadge,
  SearchInput,
  StatCard,
  cx,
} from '../components/ui'
import { formatFecha } from '../utils/fechas'
import { useData } from '../store/DataContext'
import type { RolUsuario, Usuario } from '../types'

const ROLES: Array<{ id: RolUsuario; label: string; detalle: string }> = [
  {
    id: 'admin',
    label: 'Administrador',
    detalle: 'Acceso total: equipos, empresas, usuarios e historial.',
  },
  {
    id: 'tecnico',
    label: 'Técnico',
    detalle: 'Escanea QR, diligencia reportes, carga fotos y firma.',
  },
  {
    id: 'cliente',
    label: 'Cliente',
    detalle: 'Solo consulta el inventario e historial de su empresa.',
  },
]

const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none'

type Borrador = Omit<Usuario, 'id' | 'ultimoAcceso'>

const BORRADOR_VACIO: Borrador = {
  nombre: '',
  usuario: '',
  email: '',
  rol: 'tecnico',
  empresaId: undefined,
  estado: 'activo',
}

function UsuarioModal({
  inicial,
  usuariosExistentes,
  onGuardar,
  onCerrar,
}: {
  inicial: Usuario | null
  usuariosExistentes: Usuario[]
  onGuardar: (data: Borrador) => void | Promise<void>
  onCerrar: () => void
}) {
  const { empresas } = useData()
  const [form, setForm] = useState<Borrador>(
    inicial
      ? {
          nombre: inicial.nombre,
          usuario: inicial.usuario,
          email: inicial.email,
          rol: inicial.rol,
          empresaId: inicial.empresaId,
          estado: inicial.estado,
        }
      : BORRADOR_VACIO,
  )

  const set = (patch: Partial<Borrador>) => setForm((f) => ({ ...f, ...patch }))

  const usuarioRepetido = usuariosExistentes.some(
    (u) =>
      u.id !== inicial?.id &&
      u.usuario.toLowerCase() === form.usuario.trim().toLowerCase(),
  )
  const valido =
    form.nombre.trim().length >= 3 &&
    form.usuario.trim().length >= 3 &&
    !usuarioRepetido &&
    (form.rol !== 'cliente' || Boolean(form.empresaId))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {inicial ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
            <p className="text-xs text-zinc-500">
              Define el acceso y los permisos del colaborador.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nombre completo
            </label>
            <input
              value={form.nombre}
              onChange={(e) => set({ nombre: e.target.value })}
              placeholder="Ej: Carlos Mendoza"
              autoFocus
              className={inputCls}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Usuario de acceso
              </label>
              <input
                value={form.usuario}
                onChange={(e) =>
                  set({ usuario: e.target.value.toLowerCase().replace(/\s/g, '') })
                }
                placeholder="cmendoza"
                autoCapitalize="none"
                className={cx(inputCls, usuarioRepetido && 'border-brand-500')}
              />
              {usuarioRepetido && (
                <p className="mt-1 text-xs font-semibold text-brand-700">
                  Ese usuario ya está en uso.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Correo electrónico
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="nombre@empresa.co"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">Rol</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    set({ rol: r.id, empresaId: r.id === 'cliente' ? form.empresaId : undefined })
                  }
                  className={cx(
                    'rounded-xl border px-3 py-2.5 text-center transition-all',
                    form.rol === r.id
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30'
                      : 'border-zinc-300 bg-white hover:border-zinc-400',
                  )}
                >
                  <span className="block text-xs font-bold text-zinc-900">{r.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {ROLES.find((r) => r.id === form.rol)?.detalle}
            </p>
          </div>

          {form.rol === 'cliente' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Empresa asignada
              </label>
              <select
                value={form.empresaId ?? ''}
                onChange={(e) => set({ empresaId: e.target.value || undefined })}
                className={inputCls}
              >
                <option value="">Seleccione una empresa…</option>
                {empresas.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                El cliente solo verá el inventario e historial de esta empresa.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Usuario activo</p>
              <p className="text-xs text-zinc-500">Puede iniciar sesión en el portal.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                set({ estado: form.estado === 'activo' ? 'inactivo' : 'activo' })
              }
              className={cx(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                form.estado === 'activo' ? 'bg-emerald-500' : 'bg-zinc-300',
              )}
            >
              <span
                className={cx(
                  'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                  form.estado === 'activo' ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-3.5 py-3 text-xs text-sky-900">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            <p>
              El usuario recibirá un correo con un enlace para definir su propio PIN.
              El enlace caduca en 48 horas y solo puede usarse una vez: la
              credencial nunca viaja por correo.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCerrar} className="sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => onGuardar(form)}
            disabled={!valido}
            className="sm:w-auto"
          >
            {inicial ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function UsuariosPage() {
  const { usuarios, empresas, addUsuario, updateUsuario, removeUsuario, reiniciarPin } =
    useData()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<RolUsuario | 'todos'>('todos')
  const [modal, setModal] = useState<{ abierto: boolean; usuario: Usuario | null }>({
    abierto: false,
    usuario: null,
  })

  const lista = useMemo(() => {
    const q = query.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (filtro !== 'todos' && u.rol !== filtro) return false
      if (!q) return true
      return [u.nombre, u.usuario, u.email].join(' ').toLowerCase().includes(q)
    })
  }, [usuarios, query, filtro])

  const conteos = {
    todos: usuarios.length,
    admin: usuarios.filter((u) => u.rol === 'admin').length,
    tecnico: usuarios.filter((u) => u.rol === 'tecnico').length,
    cliente: usuarios.filter((u) => u.rol === 'cliente').length,
  }
  const activos = usuarios.filter((u) => u.estado === 'activo').length

  const [error, setError] = useState<string | null>(null)
  const [invitacion, setInvitacion] = useState<{
    nombre: string
    enviado: boolean
    enlace?: string
  } | null>(null)

  const guardar = async (data: Borrador) => {
    try {
      if (modal.usuario) {
        await updateUsuario(modal.usuario.id, data)
        setInvitacion(null)
      } else {
        const nuevo = await addUsuario({ ...data, ultimoAcceso: null })
        setInvitacion({
          nombre: nuevo.nombre,
          enviado: nuevo.correoEnviado,
          enlace: nuevo.enlace,
        })
      }
      setModal({ abierto: false, usuario: null })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario')
    }
  }

  /** Invalida el PIN actual y genera un enlace nuevo. */
  const restablecerPin = async (u: Usuario) => {
    if (!confirm(`¿Enviar a ${u.nombre} un enlace para definir un PIN nuevo?`)) return
    try {
      const r = await reiniciarPin(u.id)
      setInvitacion({ nombre: u.nombre, enviado: r.correoEnviado, enlace: r.enlace })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restablecer el PIN')
    }
  }

  const eliminar = async (u: Usuario) => {
    if (!confirm(`¿Eliminar a ${u.nombre}? Perderá el acceso al portal.`)) return
    try {
      await removeUsuario(u.id)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el usuario')
    }
  }

  const alternarEstado = async (u: Usuario) => {
    try {
      await updateUsuario(u.id, {
        estado: u.estado === 'activo' ? 'inactivo' : 'activo',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado')
    }
  }

  const chips: Array<{ id: RolUsuario | 'todos'; label: string; n: number }> = [
    { id: 'todos', label: 'Todos', n: conteos.todos },
    { id: 'admin', label: 'Administradores', n: conteos.admin },
    { id: 'tecnico', label: 'Técnicos', n: conteos.tecnico },
    { id: 'cliente', label: 'Clientes', n: conteos.cliente },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios y permisos"
        subtitle="Control de acceso al portal según el rol de cada colaborador"
        actions={
          <Button onClick={() => setModal({ abierto: true, usuario: null })}>
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
        }
      />

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="size-5" />}
          label="Usuarios"
          value={String(usuarios.length)}
          hint={`${activos} activos`}
          tone="neutral"
        />
        <StatCard
          icon={<ShieldCheck className="size-5" />}
          label="Administradores"
          value={String(conteos.admin)}
          hint="acceso total"
          tone="brand"
        />
        <StatCard
          icon={<KeyRound className="size-5" />}
          label="Técnicos"
          value={String(conteos.tecnico)}
          hint="diligencian reportes"
          tone="ok"
        />
        <StatCard
          icon={<Building2 className="size-5" />}
          label="Clientes"
          value={String(conteos.cliente)}
          hint="consulta de inventario"
          tone="warn"
        />
      </div>

      {error && (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">{error}</p>
        </Card>
      )}

      {/* Resultado del envío de la invitación */}
      {invitacion && (
        <Card
          className={cx(
            'p-4',
            invitacion.enviado
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {invitacion.enviado ? (
                <p className="text-sm font-semibold text-emerald-800">
                  Se envió a {invitacion.nombre} un correo para definir su PIN.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-amber-900">
                    No se pudo enviar el correo a {invitacion.nombre}.
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Comparta este enlace por otro medio. Caduca en 48 horas y solo
                    puede usarse una vez.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-zinc-700 ring-1 ring-amber-200">
                      {invitacion.enlace}
                    </code>
                    <Button
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => {
                        if (invitacion.enlace) {
                          void navigator.clipboard.writeText(invitacion.enlace)
                        }
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInvitacion(null)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/60 hover:text-zinc-700"
            >
              <X className="size-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre, usuario o correo…"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
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
              {c.label}
              <span className={cx('font-bold', filtro === c.id ? 'text-white' : 'text-zinc-900')}>
                {c.n}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
        {/* Lista de usuarios */}
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {lista.map((u) => (
              <li
                key={u.id}
                className={cx(
                  'flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5',
                  u.estado === 'inactivo' && 'bg-zinc-50/70',
                )}
              >
                <Avatar
                  nombre={u.nombre}
                  className={cx(
                    u.rol === 'admin' && 'bg-brand-600',
                    u.estado === 'inactivo' && 'opacity-50',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cx(
                        'truncate text-sm font-semibold',
                        u.estado === 'activo' ? 'text-zinc-900' : 'text-zinc-500',
                      )}
                    >
                      {u.nombre}
                    </p>
                    <RolBadge rol={u.rol} />
                    {u.estado === 'inactivo' && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600 uppercase">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    <span className="font-mono font-semibold text-zinc-600">
                      {u.usuario}
                    </span>
                    {u.email && ` · ${u.email}`}
                    {u.rol === 'cliente' && u.empresaId && (
                      <> · {empresas.find((e) => e.id === u.empresaId)?.nombre}</>
                    )}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right md:block">
                  <p className="text-[11px] text-zinc-500">Último acceso</p>
                  <p className="text-xs font-semibold text-zinc-900">
                    {u.ultimoAcceso ? formatFecha(u.ultimoAcceso) : 'Nunca'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => void alternarEstado(u)}
                    title={u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    className={cx(
                      'rounded-lg p-2 transition-colors',
                      u.estado === 'activo'
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
                    )}
                  >
                    <Power className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void restablecerPin(u)}
                    title="Enviar enlace para definir un PIN nuevo"
                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <KeyRound className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ abierto: true, usuario: u })}
                    title="Editar"
                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void eliminar(u)}
                    title="Eliminar"
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {lista.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">
              No se encontraron usuarios con los filtros aplicados.
            </p>
          )}
        </Card>

        {/* Matriz de roles */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-600" />
            <h2 className="text-sm font-bold text-zinc-900">Roles del sistema</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {ROLES.map((r) => (
              <li key={r.id} className="rounded-xl bg-zinc-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-zinc-900">{r.label}</p>
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    {conteos[r.id]}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{r.detalle}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {modal.abierto && (
        <UsuarioModal
          inicial={modal.usuario}
          usuariosExistentes={usuarios}
          onGuardar={guardar}
          onCerrar={() => setModal({ abierto: false, usuario: null })}
        />
      )}
    </div>
  )
}
