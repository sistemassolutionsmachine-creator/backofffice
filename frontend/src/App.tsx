import { Routes, Route, Navigate } from 'react-router-dom'
import { DataProvider } from './store/DataContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { EquiposPage } from './pages/EquiposPage'
import { EquipoNuevoPage } from './pages/EquipoNuevoPage'
import { EquiposImportarPage } from './pages/EquiposImportarPage'
import { EquipoDetallePage } from './pages/EquipoDetallePage'
import { EmpresasPage } from './pages/EmpresasPage'
import { ContratosPage } from './pages/ContratosPage'
import { EscanearPage } from './pages/EscanearPage'
import { RevisionFormPage } from './pages/RevisionFormPage'
import { HistorialPage } from './pages/HistorialPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { TecnicoLayout } from './components/layout/TecnicoLayout'
import { TecnicoLoginPage } from './pages/tecnico/TecnicoLoginPage'
import { TecnicoEscanearPage } from './pages/tecnico/TecnicoEscanearPage'
import { ClientePortalPage } from './pages/cliente/ClientePortalPage'
import { ActivarCuentaPage } from './pages/ActivarCuentaPage'

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activar/:token" element={<ActivarCuentaPage />} />

        {/* Flujo del técnico (acceso vía QR) */}
        <Route path="/t" element={<TecnicoLoginPage />} />
        <Route path="/t/:codigo" element={<TecnicoLoginPage />} />
        <Route element={<TecnicoLayout />}>
          <Route path="/tecnico/escanear" element={<TecnicoEscanearPage />} />
          <Route path="/tecnico/reporte" element={<RevisionFormPage />} />
        </Route>

        {/* Portal del cliente */}
        <Route path="/cliente" element={<ClientePortalPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/equipos" replace />} />
          <Route path="/equipos" element={<EquiposPage />} />
          <Route path="/equipos/nuevo" element={<EquipoNuevoPage />} />
          <Route path="/equipos/importar" element={<EquiposImportarPage />} />
          <Route path="/equipos/:id" element={<EquipoDetallePage />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/contratos" element={<ContratosPage />} />
          <Route path="/escanear" element={<EscanearPage />} />
          <Route path="/revisiones/nueva" element={<RevisionFormPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataProvider>
  )
}
