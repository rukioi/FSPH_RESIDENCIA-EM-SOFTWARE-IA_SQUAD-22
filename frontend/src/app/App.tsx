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

import { Svo } from '../features/svo/Svo';

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

  // Tela do SVO (Adicionada pela sua branch)
  if (caminho === '/svo') {
    return (
      <GestorLayout>
        <Svo />
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
