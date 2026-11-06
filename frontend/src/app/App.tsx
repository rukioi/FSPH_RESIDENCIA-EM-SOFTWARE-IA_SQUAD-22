// App do perfil Administrador e Gestor de Frota.
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import '../shared/styles/tema.css'

import { Link, navegar, useCaminho } from './routes/router'
import { ROTAS, lerDetalheSvo, lerRotaSolicitacao } from './routes/rotas'
import { AuthSkeleton } from './AuthSkeleton'

import { AdminLayout } from '../layouts/administrador/AdminLayout'
import { perfilPodeAcessar } from '../shared/services/access.service'
import { GestorLayout } from '../layouts/gestor/GestorLayout'
import { SvoLayout } from '../layouts/svo/SvoLayout'

import { Login } from '../pages/login/Login'
import { DashboardAdmin } from '../pages/administrador/DashboardAdm'
import { Configuracoes } from '../pages/administrador/Configuracoes'
import { Auditoria } from '../pages/administrador/Auditoria'
import { Dashboard } from '../pages/gerente/DashboardGestor'
import { Veiculos } from "../pages/veiculos/Veiculos";
import { Motoristas } from "../pages/motorista/Motoristas";

import { SolicitanteLayout } from '../layouts/solicitante/SolicitanteLayout'
import { Solicitacoes } from '../pages/gerente/Solicitacoes'
import { Calendario } from '../pages/gerente/Calendario'
import { NovaSolicitacao } from '../pages/solicitante/NovaSolicitacao'
import { MinhasSolicitacoes } from '../pages/solicitante/MinhasSolicitacoes'
import { DetalheSolicitacao } from '../features/solicitacoes/DetalheSolicitacao'
import { EditarSolicitacao } from '../features/solicitacoes/EditarSolicitacao'

import { telaPreviewSvo } from '../features/svo/preview'
import { MinhasOrdensSvo, ExecucaoSvo } from '../features/svo/EquipeSvo'
import { DetalheSolicitacao as DetalheSolicitacaoSvo, DetalheOrdem } from '../features/svo/DetalhesSvo'
import { Svo } from '../features/svo/Svo';
import { CadastroSolicitacaoSvo, ListaOrdensIntegrada, ListaSolicitacoesIntegrada, TriagemSvo } from '../features/svo/SvoOperacional'
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

  const previewSvo = import.meta.env.DEV && telaPreviewSvo(caminho) !== null

  useEffect(() => {
    let ativa = true

    if (previewSvo) {
      // Navegação interna: a entrada de desenvolvimento monta a mesma prévia do acesso direto.
      window.location.reload()
      return
    }

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

      if (caminho.startsWith('/svo/') && ['ATENDENTE_SVO','MOTORISTA'].includes(usuario.perfil)) return

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
  }, [caminho, previewSvo])

  if (previewSvo) return null

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />
  }

  if (!obterToken()) {
    return <Login />
  }

  if (caminhoVerificado === caminho && sessao && caminho.startsWith('/svo/') &&
    ['ATENDENTE_SVO','MOTORISTA'].includes(sessao.perfil) && !perfilPodeAcessar(caminho, sessao.perfil)) {
    const conhecida = Object.values(ROTAS).some(rota => rota === caminho) || lerDetalheSvo(caminho)
    return <SvoLayout usuario={sessao}><h1>{conhecida ? 'Acesso negado' : 'Página não encontrada'}</h1>
      <p role="alert">{conhecida ? 'Seu perfil não tem acesso a esta página.' : 'Confira o endereço da página.'}</p>
      <Link className="svo-atalho" para={destinoDoPerfil(sessao.perfil)}>Voltar ao início</Link></SvoLayout>
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

  // ===== Solicitações e Calendário do Gestor de Frota =====
  if (caminho === ROTAS.solicitacoesGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Solicitacoes />
      </GestorLayout>
    )
  }

  if (caminho === ROTAS.calendarioGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Calendario />
      </GestorLayout>
    )
  }

  // /gestor/solicitacoes/:id e /gestor/solicitacoes/:id/editar
  const rotaGestor = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor)
  if (rotaGestor) {
    return (
      <GestorLayout usuario={sessao}>
        {rotaGestor.editar ? (
          <EditarSolicitacao key={caminho} id={rotaGestor.id} perfil="gestor" base={ROTAS.solicitacoesGestor} />
        ) : (
          <DetalheSolicitacao
            key={caminho}
            id={rotaGestor.id}
            perfil="gestor"
            base={ROTAS.solicitacoesGestor}
            rotuloVoltar="Solicitações"
            autor={{ nome: sessao.nome ?? sessao.email ?? 'Gestor', cargo: 'Gestor de Frota' }}
          />
        )}
      </GestorLayout>
    )
  }

  // ===== Telas do Solicitante =====
  if (caminho === ROTAS.novaSolicitacao) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <NovaSolicitacao usuario={sessao} />
      </SolicitanteLayout>
    )
  }

  if (caminho === ROTAS.minhasSolicitacoes) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <MinhasSolicitacoes usuario={sessao} />
      </SolicitanteLayout>
    )
  }

  // /solicitante/minhas-solicitacoes/:id e /:id/editar
  const rotaSolicitante = lerRotaSolicitacao(caminho, ROTAS.minhasSolicitacoes)
  if (rotaSolicitante) {
    return (
      <SolicitanteLayout usuario={sessao}>
        {rotaSolicitante.editar ? (
          <EditarSolicitacao key={caminho} id={rotaSolicitante.id} perfil="solicitante" base={ROTAS.minhasSolicitacoes} />
        ) : (
          <DetalheSolicitacao
            key={caminho}
            id={rotaSolicitante.id}
            perfil="solicitante"
            base={ROTAS.minhasSolicitacoes}
            rotuloVoltar="Minhas Solicitações"
            autor={{ nome: sessao.nome ?? sessao.email ?? 'Solicitante', cargo: 'Solicitante' }}
          />
        )}
      </SolicitanteLayout>
    )
  }

  // Tela do SVO
  const detalhe = lerDetalheSvo(caminho)
  const paginasSvo: Record<string, ComponentType> = {
    [ROTAS.svoNovaSolicitacao]: CadastroSolicitacaoSvo,
    [ROTAS.svoSolicitacoes]: ListaSolicitacoesIntegrada,
    [ROTAS.svoOrdens]: ListaOrdensIntegrada,
    [ROTAS.svoMinhasOrdens]: MinhasOrdensSvo,
  }
  const PaginaSvo = paginasSvo[caminho]
  if (PaginaSvo) return <SvoLayout usuario={sessao}><PaginaSvo key={caminho} /></SvoLayout>
  if (detalhe) {
    const { id, tela } = detalhe
    return <SvoLayout usuario={sessao} key={caminho}>
      {tela === 'solicitacao' && <DetalheSolicitacaoSvo id={id}/>}
      {tela === 'triagem' && <TriagemSvo id={id}/>}
      {tela === 'ordem' && <DetalheOrdem id={id}/>}
      {tela === 'execucao' && <ExecucaoSvo id={id} motorista={sessao.nome ?? '#'+sessao.id}/>}
    </SvoLayout>
  }
  if (
    caminho === ROTAS.svoRaiz ||
    caminho === ROTAS.svoDashboard
  ) {
    return (
      <SvoLayout usuario={sessao}>
        <Svo />
      </SvoLayout>
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
