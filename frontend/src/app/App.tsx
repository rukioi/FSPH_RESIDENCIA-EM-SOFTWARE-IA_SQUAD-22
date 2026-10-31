// App do perfil Administrador e Gestor de Frota.
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import '../shared/styles/tema.css'

import { navegar, useCaminho } from './routes/router'
import { ROTAS } from './routes/rotas'
import { AuthSkeleton } from './AuthSkeleton'

import { AdminLayout } from '../layouts/administrador/AdminLayout'
import { perfilPodeAcessar } from '../shared/services/access.service'
import { GestorLayout } from '../layouts/gestor/GestorLayout'

import { Login } from '../pages/login/Login'
import { DashboardAdmin } from '../pages/administrador/DashboardAdm'
import { Configuracoes } from '../pages/administrador/Configuracoes'
import { Auditoria } from '../pages/administrador/Auditoria'
import { Dashboard } from '../pages/gerente/DashboardGestor'
import { Veiculos } from "../pages/veiculos/Veiculos";
import { Motoristas } from "../pages/motorista/Motoristas";

import { Svo } from '../features/svo/Svo';
import {
  buscarSessao,
  destinoDoPerfil,
  obterToken,
  sair,
} from '../shared/services/auth.service'
import type { UsuarioSessao } from '../shared/services/auth.service'

const paginas: Record<string, ComponentType> = {
  [ROTAS.dashboard]: DashboardAdmin,
  [ROTAS.configuracoes]: Configuracoes,
  [ROTAS.auditoria]: Auditoria,
}

/** Confirma a sessão da rota atual antes de montar qualquer página protegida. */
export function App() {
  const caminho = useCaminho()
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null)
  const [caminhoVerificado, setCaminhoVerificado] = useState<string | null>(null)

  useEffect(() => {
    let ativa = true

    if (!obterToken()) {
      sair()
      setSessao(null)
      setCaminhoVerificado(null)
      if (caminho !== ROTAS.login) navegar(ROTAS.login, true)
      return () => {
        ativa = false
      }
    }

    setCaminhoVerificado(null)
    void buscarSessao().then((usuario) => {
      if (!ativa) return

      setSessao(usuario)
      setCaminhoVerificado(caminho)

      if (!usuario) {
        sair()
        if (caminho !== ROTAS.login) navegar(ROTAS.login, true)
        return
      }

      if (caminho === ROTAS.login || !perfilPodeAcessar(caminho, usuario.perfil)) {
        try {
          navegar(destinoDoPerfil(usuario.perfil), true)
        } catch {
          sair()
          navegar(ROTAS.login, true)
        }
      }
    }).catch(() => {
      if (!ativa) return
      sair()
      setSessao(null)
      setCaminhoVerificado(null)
      navegar(ROTAS.login, true)
    })

    return () => {
      ativa = false
    }
  }, [caminho])

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />
  }

  if (!obterToken()) {
    return <Login />
  }

  if (caminhoVerificado !== caminho || !sessao || !perfilPodeAcessar(caminho, sessao.perfil)) {
    return <AuthSkeleton caminho={caminho} />
  }

  // Tela do Gestor de Frota
  if (caminho === ROTAS.dashboardGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Dashboard />
      </GestorLayout>
    )
  }

// Telas de Veículos e Motoristas do Gestor de Frota
  if (caminho === ROTAS.veiculosGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Veiculos />
      </GestorLayout>
    )
  }

  if (caminho === ROTAS.motoristasGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Motoristas />
      </GestorLayout>
    )
  }

  // Tela do SVO
  if (caminho === '/svo') {
    return (
      <GestorLayout usuario={sessao}>
        <Svo />
      </GestorLayout>
    )
  }

  // Telas do Administrador e fallback
  const Pagina = paginas[caminho] ?? DashboardAdmin

  return (
    <AdminLayout usuario={sessao}>
      <Pagina />
    </AdminLayout>
  )
}
