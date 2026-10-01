import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, type Invitacion, type UsuarioCreado } from '../api/client'
import type { Contrato, Empresa, Equipo, Usuario } from '../types'

/**
 * Estado compartido del portal.
 *
 * Los datos viven en DynamoDB; aquí se mantiene una copia en memoria para no
 * repetir peticiones en cada pantalla. Tras cada escritura se actualiza esa
 * copia con lo que devolvió el servidor, que es la fuente de verdad.
 */

interface DataContextValue {
  equipos: Equipo[]
  empresas: Empresa[]
  contratos: Contrato[]
  usuarios: Usuario[]
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
  addContrato: (data: Partial<Contrato>) => Promise<Contrato>
  updateContrato: (id: string, patch: Partial<Contrato>) => Promise<void>

  addEquipo: (data: Omit<Equipo, 'id'>) => Promise<Equipo>
  updateEquipo: (id: string, patch: Partial<Equipo>) => Promise<void>
  removeEquipo: (id: string) => Promise<void>

  addEmpresa: (data: Omit<Empresa, 'id'>) => Promise<Empresa>
  updateEmpresa: (id: string, patch: Partial<Empresa>) => Promise<void>
  removeEmpresa: (id: string) => Promise<void>

  addUsuario: (data: Partial<Usuario>) => Promise<UsuarioCreado>
  updateUsuario: (
    id: string,
    patch: Partial<Usuario> & { confirmacion?: string },
  ) => Promise<void>
  removeUsuario: (id: string) => Promise<void>
  reiniciarPin: (id: string) => Promise<Invitacion>

  getEquipo: (id: string) => Equipo | undefined
  getEmpresa: (id: string) => Empresa | undefined
  equiposDeEmpresa: (empresaId: string) => Equipo[]
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    if (!getToken()) return
    setCargando(true)
    setError(null)
    try {
      const [eq, em] = await Promise.all([
        api.equipos.listar(),
        api.empresas.listar(),
      ])
      setEquipos(eq)
      setEmpresas(em)

      // Mantiene visible el inventario si el módulo de contratos no responde.
      try {
        setContratos(await api.contratos.listar())
      } catch (e) {
        setContratos([])
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los contratos')
      }

      // Solo el administrador puede consultar el listado de usuarios.
      try {
        setUsuarios(await api.usuarios.listar())
      } catch {
        setUsuarios([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  /* ---------- Equipos ---------- */

  const addContrato = useCallback(async (data: Partial<Contrato>) => {
    const nuevo = await api.contratos.crear(data)
    setContratos((s) => [nuevo, ...s])
    return nuevo
  }, [])

  const updateContrato = useCallback(async (id: string, patch: Partial<Contrato>) => {
    const actualizado = await api.contratos.actualizar(id, patch)
    setContratos((s) => s.map((c) => c.id === id ? actualizado : c))
  }, [])

  const addEquipo = useCallback(async (data: Omit<Equipo, 'id'>) => {
    const nuevo = await api.equipos.crear(data)
    setEquipos((s) => [nuevo, ...s])
    return nuevo
  }, [])

  const updateEquipo = useCallback(async (id: string, patch: Partial<Equipo>) => {
    const actualizado = await api.equipos.actualizar(id, patch)
    setEquipos((s) => s.map((e) => (e.id === id ? actualizado : e)))
  }, [])

  const removeEquipo = useCallback(async (id: string) => {
    await api.equipos.eliminar(id)
    setEquipos((s) => s.filter((e) => e.id !== id))
  }, [])

  /* ---------- Empresas ---------- */

  const addEmpresa = useCallback(async (data: Omit<Empresa, 'id'>) => {
    const nueva = await api.empresas.crear(data)
    setEmpresas((s) => [...s, nueva])
    return nueva
  }, [])

  const updateEmpresa = useCallback(async (id: string, patch: Partial<Empresa>) => {
    const actualizada = await api.empresas.actualizar(id, patch)
    setEmpresas((s) => s.map((e) => (e.id === id ? actualizada : e)))
  }, [])

  const removeEmpresa = useCallback(async (id: string) => {
    await api.empresas.eliminar(id)
    setEmpresas((s) => s.filter((e) => e.id !== id))
  }, [])

  /* ---------- Usuarios ---------- */

  const addUsuario = useCallback(async (data: Partial<Usuario>) => {
    const nuevo = await api.usuarios.crear(data)
    setUsuarios((s) => [nuevo, ...s])
    return nuevo
  }, [])

  const updateUsuario = useCallback(async (
    id: string,
    patch: Partial<Usuario> & { confirmacion?: string },
  ) => {
    const actualizado = await api.usuarios.actualizar(id, patch)
    setUsuarios((s) => s.map((u) => (u.id === id ? actualizado : u)))
  }, [])

  const removeUsuario = useCallback(async (id: string) => {
    await api.usuarios.eliminar(id)
    setUsuarios((s) => s.filter((u) => u.id !== id))
  }, [])

  const reiniciarPin = useCallback(async (id: string) => {
    return api.usuarios.reiniciarPin(id)
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      equipos,
      empresas,
      contratos,
      usuarios,
      cargando,
      error,
      recargar,
      addContrato,
      updateContrato,
      addEquipo,
      updateEquipo,
      removeEquipo,
      addEmpresa,
      updateEmpresa,
      removeEmpresa,
      addUsuario,
      updateUsuario,
      removeUsuario,
      reiniciarPin,
      getEquipo: (id) => equipos.find((e) => e.id === id),
      getEmpresa: (id) => empresas.find((e) => e.id === id),
      equiposDeEmpresa: (empresaId) =>
        equipos.filter((e) => e.empresaId === empresaId),
    }),
    [
      equipos,
      empresas,
      contratos,
      usuarios,
      cargando,
      error,
      recargar,
      addContrato,
      updateContrato,
      addEquipo,
      updateEquipo,
      removeEquipo,
      addEmpresa,
      updateEmpresa,
      removeEmpresa,
      addUsuario,
      updateUsuario,
      removeUsuario,
      reiniciarPin,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
