import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  empresas as empresasSeed,
  equipos as equiposSeed,
  usuarios as usuariosSeed,
} from '../data/mock'
import type { Empresa, Equipo, Usuario } from '../types'

const STORAGE_KEY = 'sm-portal-data-v2'

interface DataContextValue {
  equipos: Equipo[]
  empresas: Empresa[]
  usuarios: Usuario[]
  addEquipo: (data: Omit<Equipo, 'id'>) => Equipo
  addEmpresa: (data: Omit<Empresa, 'id'>) => Empresa
  updateEmpresa: (id: string, patch: Partial<Omit<Empresa, 'id'>>) => void
  removeEmpresa: (id: string) => boolean
  addUsuario: (data: Omit<Usuario, 'id'>) => Usuario
  updateUsuario: (id: string, patch: Partial<Omit<Usuario, 'id'>>) => void
  removeUsuario: (id: string) => void
  getEquipo: (id: string) => Equipo | undefined
  getEmpresa: (id: string) => Empresa | undefined
  equiposDeEmpresa: (empresaId: string) => Equipo[]
}

const DataContext = createContext<DataContextValue | null>(null)

function cargarInicial(): {
  equipos: Equipo[]
  empresas: Empresa[]
  usuarios: Usuario[]
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (
        Array.isArray(data.equipos) &&
        Array.isArray(data.empresas) &&
        Array.isArray(data.usuarios)
      ) {
        return data
      }
    }
  } catch {
    // Datos corruptos: se re-siembra desde el mock
  }
  return { equipos: equiposSeed, empresas: empresasSeed, usuarios: usuariosSeed }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(cargarInicial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addEquipo = useCallback((data: Omit<Equipo, 'id'>) => {
    const nuevo: Equipo = { ...data, id: `eq-${Date.now().toString(36)}` }
    setState((s) => ({ ...s, equipos: [nuevo, ...s.equipos] }))
    return nuevo
  }, [])

  const addEmpresa = useCallback((data: Omit<Empresa, 'id'>) => {
    const nueva: Empresa = { ...data, id: `em-${Date.now().toString(36)}` }
    setState((s) => ({ ...s, empresas: [...s.empresas, nueva] }))
    return nueva
  }, [])

  const updateEmpresa = useCallback(
    (id: string, patch: Partial<Omit<Empresa, 'id'>>) => {
      setState((s) => ({
        ...s,
        empresas: s.empresas.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [],
  )

  const removeEmpresa = useCallback(
    (id: string) => {
      if (state.equipos.some((eq) => eq.empresaId === id)) return false
      setState((s) => ({ ...s, empresas: s.empresas.filter((e) => e.id !== id) }))
      return true
    },
    [state.equipos],
  )

  const addUsuario = useCallback((data: Omit<Usuario, 'id'>) => {
    const nuevo: Usuario = { ...data, id: `us-${Date.now().toString(36)}` }
    setState((s) => ({ ...s, usuarios: [nuevo, ...s.usuarios] }))
    return nuevo
  }, [])

  const updateUsuario = useCallback(
    (id: string, patch: Partial<Omit<Usuario, 'id'>>) => {
      setState((s) => ({
        ...s,
        usuarios: s.usuarios.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      }))
    },
    [],
  )

  const removeUsuario = useCallback((id: string) => {
    setState((s) => ({ ...s, usuarios: s.usuarios.filter((u) => u.id !== id) }))
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      equipos: state.equipos,
      empresas: state.empresas,
      usuarios: state.usuarios,
      addEquipo,
      addEmpresa,
      updateEmpresa,
      removeEmpresa,
      addUsuario,
      updateUsuario,
      removeUsuario,
      getEquipo: (id) => state.equipos.find((e) => e.id === id),
      getEmpresa: (id) => state.empresas.find((e) => e.id === id),
      equiposDeEmpresa: (empresaId) =>
        state.equipos.filter((e) => e.empresaId === empresaId),
    }),
    [
      state,
      addEquipo,
      addEmpresa,
      updateEmpresa,
      removeEmpresa,
      addUsuario,
      updateUsuario,
      removeUsuario,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}
