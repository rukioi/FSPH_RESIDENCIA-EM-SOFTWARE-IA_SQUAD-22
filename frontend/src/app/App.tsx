// App do perfil Administrador e Gestor de Frota.
import type { ComponentType } from 'react'
import '../shared/styles/tema.css'

import { useCaminho } from './routes/router'
import { ROTAS } from './routes/rotas'

import { AdminLayout } from '../layouts/administrador/AdminLayout'
import { GestorLayout } from '../layouts/gestor/GestorLayout'

import { Login } from '../pages/login/Login'
import { DashboardAdmin } from '../pages/administrador/DashboardAdm'
import { Configuracoes } from '../pages/administrador/Configuracoes'
import { Auditoria } from '../pages/administrador/Auditoria'
import { Dashboard } from '../pages/gerente/DashboardGestor'
import { Veiculos } from "../pages/veiculos/Veiculos";
import { Motoristas } from "../pages/motorista/Motoristas";

const paginas: Record<string, ComponentType> = {
  [ROTAS.dashboard]: DashboardAdmin,
  [ROTAS.configuracoes]: Configuracoes,
  [ROTAS.auditoria]: Auditoria,
}

export function App() {
  const caminho = useCaminho()

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />
  }

  // Tela do Gestor de Frota
  if (caminho === ROTAS.dashboardGestor) {
    return (
      <GestorLayout>
        <Dashboard />
      </GestorLayout>
    )
  }

  if (caminho === ROTAS.veiculosGestor) {
  return (
    <GestorLayout>
      <Veiculos />
    </GestorLayout>
  )
}

if (caminho === ROTAS.motoristasGestor) {
  return (
    <GestorLayout>
      <Motoristas />
    </GestorLayout>
  )
}


  // Telas do Administrador e fallback
  const Pagina = paginas[caminho] ?? DashboardAdmin

  return (
    <AdminLayout>
      <Pagina />
    </AdminLayout>
  )
}