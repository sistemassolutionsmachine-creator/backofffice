import { useMemo, useState } from 'react'
import {
  Building2,
  Crown,
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
import { InvitacionModal, type EstadoInvitacion } from '../components/InvitacionModal'
import { ConfirmarFraseModal } from '../components/ConfirmarFraseModal'
import { Selector } from '../components/Selector'
import { getUsuario } from '../utils/auth'
import type { RolUsuario, Usuario } from '../types'

/** Acción sensible sobre un superadministrador que exige confirmar por escrito. */
interface AccionProtegida {
  usuario: Usuario
  patch: Partial<Usuario>
  accion: 'desactivar' | 'revocar'
}

/**
 * Indica si el cambio quita la protección a un superadministrador.
 * Debe coincidir con la regla del servidor, que es la que decide.
 */
function accionProtegida(u: Usuario, patch: Partial<Usuario>): AccionProtegida | null {
  if (!u.superadmin) return null
  const estado = patch.estado ?? u.estado
  const rol = patch.rol ?? u.rol
  const sigueSiendo = rol === 'admin' && estado === 'activo' && (patch.superadmin ?? true)
  if (sigueSiendo) return null
  const desactiva = u.estado === 'activo' && estado === 'inactivo'
  return { usuario: u, patch, accion: desactiva ? 'desactivar' : 'revocar' }
}

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
  puedeDesignar,
  puedeGestionarSuper,
}: {
  inicial: Usuario | null
  usuariosExistentes: Usuario[]
  onGuardar: (data: Borrador) => void | Promise<void>
  onCerrar: () => void
  /** Si quien edita puede convertir a alguien en superadministrador. */
  puedeDesignar: boolean
  /** Si quien edita puede modificar a un superadministrador. */
  puedeGestionarSuper: boolean
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
          superadmin: Boolean(inicial.superadmin),
        }
      : BORRADOR_VACIO,
  )
  const bloqueado = Boolean(inicial?.superadmin) && !puedeGestionarSuper
  const superBloqueado = form.superadmin
    ? !puedeGestionarSuper
    : !puedeDesignar || Boolean(inicial?.pendienteActivacion)

  const set = (patch: Partial<Borrador>) => setForm((f) => ({ ...f, ...patch }))

  const usuarioRepetido = usuariosExistentes.some(
    (u) =>
      u.id !== inicial?.id &&
      u.usuario.toLowerCase() === form.usuario.trim().toLowerCase(),
  )
  const valido =
    !bloqueado &&
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

            {form.rol === 'admin' && inicial && (
              <label
                className={cx(
                  'mt-3 flex items-start gap-3 rounded-xl border p-3.5 transition-colors',
                  form.superadmin
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-zinc-200 bg-white',
                  superBloqueado ? 'opacity-60' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.superadmin)}
                  disabled={superBloqueado}
                  onChange={(e) => set({ superadmin: e.target.checked })}
                  className="mt-0.5 size-4 shrink-0 accent-amber-500"
                />
                <span className="text-xs text-zinc-600">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
                    <Crown className="size-4 text-amber-500" />
                    Superadministrador
                  </span>
                  Cuenta protegida: solo otro superadministrador puede editarla, y
                  desactivarla exige escribir <code>desactivar {inicial.usuario}</code>.
                  {!puedeDesignar && !form.superadmin && (
                    <span className="mt-1 block font-semibold text-zinc-500">
                      Solo un superadministrador puede designar a otro.
                    </span>
                  )}
                  {inicial.pendienteActivacion && (
                    <span className="mt-1 block font-semibold text-zinc-500">
                      Disponible cuando el usuario active su cuenta.
                    </span>
                  )}
                </span>
              </label>
            )}
          </div>

          {form.rol === 'cliente' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Empresa asignada
              </label>
              <Selector
                ariaLabel="Empresa asignada"
                value={form.empresaId ?? ''}
                onChange={(v) => set({ empresaId: v || undefined })}
                placeholder="Seleccione una empresa…"
                opciones={empresas.map((em) => ({ valor: em.id, etiqueta: em.nombre }))}
              />
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

        {bloqueado && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs font-semibold text-amber-900">
            <Crown className="mt-0.5 size-3.5 shrink-0" />
            Solo un superadministrador puede modificar esta cuenta.
          </p>
        )}

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
  const [invitacion, setInvitacion] = useState<EstadoInvitacion | null>(null)
  const [usuarioPin, setUsuarioPin] = useState<Usuario | null>(null)
  const [protegida, setProtegida] = useState<AccionProtegida | null>(null)
  const [designar, setDesignar] = useState('')

  const yo = getUsuario()
  const soySuper = Boolean(usuarios.find((u) => u.id === yo?.id)?.superadmin)
  const superadmins = usuarios.filter((u) => u.superadmin && u.estado === 'activo')
  // Sin ninguno designado, cualquier administrador puede nombrar al primero.
  const puedeDesignar = soySuper || superadmins.length === 0
  const candidatos = usuarios.filter(
    (u) => u.rol === 'admin' && u.estado === 'activo' && !u.superadmin && !u.pendienteActivacion,
  )

  const guardar = async (data: Borrador) => {
    try {
      if (modal.usuario) {
        const sensible = accionProtegida(modal.usuario, data)
        if (sensible) {
          // Se cierra el editor y se pide la frase antes de enviar el cambio.
          setModal({ abierto: false, usuario: null })
          setProtegida(sensible)
          return
        }
        await updateUsuario(modal.usuario.id, data)
        setInvitacion(null)
      } else {
        setInvitacion({ nombre: data.nombre, email: data.email, estado: 'enviando' })
        const nuevo = await addUsuario({ ...data, ultimoAcceso: null })
        setInvitacion({
          nombre: nuevo.nombre,
          email: nuevo.email,
          estado: nuevo.correoEnviado ? 'enviado' : 'alternativo',
          enlace: nuevo.enlace,
        })
      }
      setModal({ abierto: false, usuario: null })
      setError(null)
    } catch (e) {
      if (!modal.usuario) setInvitacion({ nombre: data.nombre, estado: 'error', motivo: e instanceof Error ? e.message : 'No se pudo crear el usuario' })
      setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario')
    }
  }

  /** Invalida el PIN actual y genera un enlace nuevo. */
  const restablecerPin = async (u: Usuario) => {
    setInvitacion({ nombre: u.nombre, email: u.email, estado: 'enviando' })
    try {
      const r = await reiniciarPin(u.id)
      setInvitacion({ nombre: u.nombre, email: u.email, estado: r.correoEnviado ? 'enviado' : 'alternativo', enlace: r.enlace })
      setError(null)
    } catch (e) {
      setInvitacion({ nombre: u.nombre, estado: 'error', motivo: e instanceof Error ? e.message : 'No se pudo restablecer el PIN' })
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
    const patch: Partial<Usuario> = { estado: u.estado === 'activo' ? 'inactivo' : 'activo' }
    const sensible = accionProtegida(u, patch)
    if (sensible) {
      setProtegida(sensible)
      return
    }
    try {
      await updateUsuario(u.id, patch)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado')
    }
  }

  const designarSuper = async () => {
    if (!designar) return
    try {
      await updateUsuario(designar, { superadmin: true })
      setDesignar('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo designar al superadministrador')
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
        <InvitacionModal invitacion={invitacion}
          onCerrar={() => { setInvitacion(null); setUsuarioPin(null) }}
          onConfirmar={() => { if (usuarioPin) void restablecerPin(usuarioPin) }} />
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
                    {u.superadmin && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Crown className="size-3" />
                        Superadmin
                      </span>
                    )}
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
                    disabled={u.superadmin && !soySuper}
                    title={
                      u.superadmin && !soySuper
                        ? 'Solo un superadministrador puede desactivarlo'
                        : u.estado === 'activo'
                          ? 'Desactivar'
                          : 'Activar'
                    }
                    className={cx(
                      'rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-30 transition-colors',
                      u.estado === 'activo'
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700',
                    )}
                  >
                    <Power className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsuarioPin(u)
                      setInvitacion({ nombre: u.nombre, email: u.email, estado: 'confirmar' })
                    }}
                    disabled={u.superadmin && !soySuper}
                    title="Enviar enlace para definir un PIN nuevo"
                    className="rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-30 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <KeyRound className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ abierto: true, usuario: u })}
                    title="Editar"
                    className="rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-30 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void eliminar(u)}
                    disabled={u.superadmin}
                    title={u.superadmin ? 'Revoque el rol de superadministrador antes de eliminar' : 'Eliminar'}
                    className="rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-30 text-zinc-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
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
            {/* Superadministrador: administrador protegido */}
            <li className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">
                  <Crown className="size-4 text-amber-500" />
                  Superadministrador
                </p>
                <span className="font-mono text-xs font-bold text-amber-700">
                  {superadmins.length}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Administrador protegido. Solo otro superadministrador puede editarlo, y
                desactivarlo exige escribir <code>desactivar usuario</code>.
              </p>
              {superadmins.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {superadmins.map((s) => (
                    <li key={s.id} className="truncate text-xs font-semibold text-amber-900">
                      {s.nombre} <span className="font-mono text-amber-700">· {s.usuario}</span>
                    </li>
                  ))}
                </ul>
              )}
              {puedeDesignar ? (
                candidatos.length > 0 ? (
                  <div className="mt-3 flex gap-2">
                    <Selector
                      compacto
                      className="min-w-0 flex-1"
                      ariaLabel="Administrador a designar como superadministrador"
                      value={designar}
                      onChange={setDesignar}
                      placeholder="Elegir administrador…"
                      opciones={candidatos.map((c) => ({
                        valor: c.id,
                        etiqueta: c.nombre,
                        detalle: c.usuario,
                      }))}
                    />
                    <Button
                      className="shrink-0 px-3 py-2 text-xs"
                      disabled={!designar}
                      onClick={() => void designarSuper()}
                    >
                      Marcar
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    No hay otros administradores activos para designar.
                  </p>
                )
              ) : (
                <p className="mt-2 text-[11px] font-semibold text-zinc-500">
                  Solo un superadministrador puede designar a otro.
                </p>
              )}
            </li>
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
          puedeDesignar={puedeDesignar}
          puedeGestionarSuper={soySuper}
        />
      )}

      {protegida && (
        <ConfirmarFraseModal
          titulo={
            protegida.accion === 'desactivar'
              ? 'Desactivar superadministrador'
              : 'Revocar superadministrador'
          }
          descripcion={
            protegida.accion === 'desactivar'
              ? `${protegida.usuario.nombre} dejará de poder iniciar sesión y perderá su rol de superadministrador. Esta acción es sensible.`
              : `${protegida.usuario.nombre} seguirá activo, pero dejará de estar protegido como superadministrador.`
          }
          frase={`${protegida.accion} ${protegida.usuario.usuario}`}
          textoBoton={protegida.accion === 'desactivar' ? 'Desactivar' : 'Revocar'}
          onCerrar={() => setProtegida(null)}
          onConfirmar={async (confirmacion) => {
            await updateUsuario(protegida.usuario.id, { ...protegida.patch, confirmacion })
            setProtegida(null)
            setError(null)
          }}
        />
      )}
    </div>
  )
}
