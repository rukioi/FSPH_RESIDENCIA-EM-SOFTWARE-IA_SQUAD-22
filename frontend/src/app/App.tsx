// App do perfil Administrador.
import type { ComponentType } from 'react'
import '../shared/styles/tema.css'
import { useCaminho } from './routes/router'
import { ROTAS } from './routes/rotas'
import { AdminLayout } from '../layouts/administrador/AdminLayout'
import { Login } from '../pages/login/Login'
import { DashboardAdmin } from '../pages/administrador/DashboardAdm'
import { Configuracoes } from '../pages/administrador/Configuracoes'
import { Auditoria } from '../pages/administrador/Auditoria'

const paginas: Record<string, ComponentType> = {
  [ROTAS.dashboard]: DashboardAdmin,
  [ROTAS.configuracoes]: Configuracoes,
  [ROTAS.auditoria]: Auditoria,
}

export function App() {
  const caminho = useCaminho()

  // Tela de login em /login
  if (caminho === ROTAS.login) return <Login />


  // Para obrigar login, troque a linha abaixo por:
  //   const Pagina = paginas[caminho]
  // e devolva <Login /> quando Pagina não existir.
  const Pagina = paginas[caminho] ?? DashboardAdmin

  return (
    <AdminLayout>
      <Pagina />
    </AdminLayout>
  )
}

// App do perfil Gestor de Frota.
/* 

import { GestorLayout } from "../layouts/gestor/GestorLayout";
import { Dashboard } from "../pages/gerente/DashboardGestor";

export function App() {
  return (
    <GestorLayout>
      <Dashboard />
    </GestorLayout>
  );
}

*/