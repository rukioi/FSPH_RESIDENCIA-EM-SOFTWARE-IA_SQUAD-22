// App do perfil Administrador e Gestor de Frota.
import { lazy, Suspense, useEffect, useState } from "react";
import { NotificacoesProvider } from "../features/notificacoes/NotificacoesContext";
const Notificacoes = lazy(() => import('../features/notificacoes/Notificacoes').then(module => ({ default: module.Notificacoes })));
import type { ComponentType } from "react";
import "../shared/styles/tema.css";

import { Link, navegar, useCaminho } from './routes/router'
import { ROTAS, lerDetalheSvo, lerRotaDetalheAbastecimento, lerRotaHistoricoAbastecimentosVeiculo, lerRotaSolicitacao } from './routes/rotas'
import { AuthSkeleton } from './AuthSkeleton'

import { AdminLayout } from '../layouts/administrador/AdminLayout'
import { perfilPodeAcessar } from '../shared/services/access.service'
import { GestorLayout } from '../layouts/gestor/GestorLayout'
import { SvoLayout } from '../layouts/svo/SvoLayout'

const Login = lazy(() => import('../pages/login/Login').then(module => ({ default: module.Login })));
const DashboardAdmin = lazy(() => import('../pages/administrador/DashboardAdm').then(module => ({ default: module.DashboardAdmin })));
const Configuracoes = lazy(() => import('../pages/administrador/Configuracoes').then(module => ({ default: module.Configuracoes })));
const Auditoria = lazy(() => import('../pages/administrador/Auditoria').then(module => ({ default: module.Auditoria })));
const Dashboard = lazy(() => import('../pages/gerente/DashboardGestor').then(module => ({ default: module.Dashboard })));
const Veiculos = lazy(() => import('../pages/veiculos/Veiculos').then(module => ({ default: module.Veiculos })));
const Motoristas = lazy(() => import('../pages/motorista/Motoristas').then(module => ({ default: module.Motoristas })));
const Abastecimentos = lazy(() => import('../pages/abastecimentos/Abastecimentos').then(module => ({ default: module.Abastecimentos })));
const Relatorios = lazy(() => import('../features/relatorios/Relatorios').then(module => ({ default: module.Relatorios })));
import type { ConsultaRelatorio } from '../shared/services/relatorios.service';
const DetalheAbastecimento = lazy(() => import('../pages/abastecimentos/DetalheAbastecimento').then(module => ({ default: module.DetalheAbastecimento })));
const HistoricoAbastecimentos = lazy(() => import('../pages/abastecimentos/HistoricoAbastecimentos').then(module => ({ default: module.HistoricoAbastecimentos })));
const IndicadoresAbastecimentos = lazy(() => import('../pages/abastecimentos/IndicadoresAbastecimentos').then(module => ({ default: module.IndicadoresAbastecimentos })));

import { SolicitanteLayout } from '../layouts/solicitante/SolicitanteLayout'
const Solicitacoes = lazy(() => import('../pages/gerente/Solicitacoes').then(module => ({ default: module.Solicitacoes })));
const Calendario = lazy(() => import('../pages/gerente/Calendario').then(module => ({ default: module.Calendario })));
const NovaSolicitacao = lazy(() => import('../pages/solicitante/NovaSolicitacao').then(module => ({ default: module.NovaSolicitacao })));
const MinhasSolicitacoes = lazy(() => import('../pages/solicitante/MinhasSolicitacoes').then(module => ({ default: module.MinhasSolicitacoes })));
const DetalheSolicitacao = lazy(() => import('../features/solicitacoes/DetalheSolicitacao').then(module => ({ default: module.DetalheSolicitacao })));
const EditarSolicitacao = lazy(() => import('../features/solicitacoes/EditarSolicitacao').then(module => ({ default: module.EditarSolicitacao })));

import { telaPreviewSvo } from '../features/svo/preview'
const MinhasOrdensSvo = lazy(() => import('../features/svo/EquipeSvo').then(module => ({ default: module.MinhasOrdensSvo })));
const ExecucaoSvo = lazy(() => import('../features/svo/EquipeSvo').then(module => ({ default: module.ExecucaoSvo })));
const DetalheSolicitacaoSvo = lazy(() => import('../features/svo/DetalhesSvo').then(module => ({ default: module.DetalheSolicitacao })));
const DetalheOrdem = lazy(() => import('../features/svo/DetalhesSvo').then(module => ({ default: module.DetalheOrdem })));
const Svo = lazy(() => import('../features/svo/Svo').then(module => ({ default: module.Svo })));
const CadastroSolicitacaoSvo = lazy(() => import('../features/svo/SvoOperacional').then(module => ({ default: module.CadastroSolicitacaoSvo })));
const ListaOrdensIntegrada = lazy(() => import('../features/svo/SvoOperacional').then(module => ({ default: module.ListaOrdensIntegrada })));
const ListaSolicitacoesIntegrada = lazy(() => import('../features/svo/SvoOperacional').then(module => ({ default: module.ListaSolicitacoesIntegrada })));
const TriagemSvo = lazy(() => import('../features/svo/SvoOperacional').then(module => ({ default: module.TriagemSvo })));
import {
  buscarSessao,
  destinoDoPerfil,
  obterToken,
  sair,
} from "../shared/services/auth.service";
import '../shared/styles/hierarquia.css';
import type { UsuarioSessao } from "../shared/services/auth.service";

const paginas: Record<string, ComponentType> = {
  [ROTAS.dashboard]: DashboardAdmin,
  [ROTAS.configuracoes]: Configuracoes,
  [ROTAS.auditoria]: Auditoria,
};

/** Confirma a sessão da rota atual antes de montar qualquer página protegida. */
export function App() {
  useCaminho();
  return (
    <NotificacoesProvider key={obterToken() ?? "sem-sessao"}>
      <Suspense fallback={<div role="status" className="conteudo">Carregando página…</div>}><AppContent /></Suspense>
    </NotificacoesProvider>
  );
}

function AppContent() {
  const caminho = useCaminho();
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [caminhoVerificado, setCaminhoVerificado] = useState<string | null>(
    null,
  );

  const previewSvo = import.meta.env.DEV && telaPreviewSvo(caminho) !== null

  useEffect(() => {
    let ativa = true;

    if (previewSvo) {
      // Navegação interna: a entrada de desenvolvimento monta a mesma prévia do acesso direto.
      window.location.reload()
      return
    }

    if (!obterToken()) {
      sair();
      setSessao(null);
      setCaminhoVerificado(null);
      if (caminho !== ROTAS.login) navegar(ROTAS.login, true);
      return () => {
        ativa = false;
      };
    }

    setCaminhoVerificado(null);
    void buscarSessao()
      .then((usuario) => {
        if (!ativa) return;

        setSessao(usuario);
        setCaminhoVerificado(caminho);

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

          if (
            caminho === ROTAS.login ||
            !perfilPodeAcessar(caminho, usuario.perfil)
          ) {
            try {
              navegar(destinoDoPerfil(usuario.perfil), true);
            } catch {
              sair();
              navegar(ROTAS.login, true);
            }
          }
        }}
      ).catch(() => {
        if (!ativa) return;
        sair();
        setSessao(null);
        setCaminhoVerificado(null);
        navegar(ROTAS.login, true);
      });

    return () => {
      ativa = false
    }
  }, [caminho, previewSvo])

  if (previewSvo) return null

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />;
  }

  if (!obterToken()) {
    return <Login />;
  }

  if (caminhoVerificado === caminho && sessao && caminho.startsWith('/svo/') &&
    ['ATENDENTE_SVO','MOTORISTA'].includes(sessao.perfil) && !perfilPodeAcessar(caminho, sessao.perfil)) {
    const conhecida = Object.values(ROTAS).some(rota => rota === caminho) || lerDetalheSvo(caminho)
    return <SvoLayout usuario={sessao}><h1>{conhecida ? 'Acesso negado' : 'Página não encontrada'}</h1>
      <p role="alert">{conhecida ? 'Seu perfil não tem acesso a esta página.' : 'Confira o endereço da página.'}</p>
      <Link className="svo-atalho" para={destinoDoPerfil(sessao.perfil)}>Voltar ao início</Link></SvoLayout>
  }
  if (caminhoVerificado !== caminho || !sessao || !perfilPodeAcessar(caminho, sessao.perfil)) {
    if (sessao && perfilPodeAcessar(caminho, sessao.perfil) && caminho.startsWith('/gestor/')) {
      return <GestorLayout usuario={sessao}><AuthSkeleton caminho={caminho} somenteConteudo /></GestorLayout>
    }
    return <AuthSkeleton caminho={caminho} />;
  }

  if (caminho === ROTAS.notificacoes) {
    const Layout =
      sessao.perfil === "ADM"
        ? AdminLayout
        : sessao.perfil === "SOLICITANTE_INTERNO"
          ? SolicitanteLayout
          : GestorLayout;
    return (
      <Layout usuario={sessao}>
        <Notificacoes />
      </Layout>
    );
  }

  // Tela do Gestor de Frota
  const tiposRelatorio: Record<string, ConsultaRelatorio['tipo']> = {
    [ROTAS.relatoriosGestor]: 'viagens', [ROTAS.relatorioVeiculos]: 'veiculos',
    [ROTAS.relatorioMotoristas]: 'motoristas', [ROTAS.relatorioSolicitacoes]: 'solicitacoes',
    [ROTAS.relatorioAbastecimentos]: 'abastecimentos', [ROTAS.svoRelatorios]: 'svo',
  };
  if (tiposRelatorio[caminho]) {
    const Layout = caminho === ROTAS.svoRelatorios ? SvoLayout : GestorLayout;
    return <Layout usuario={sessao}><Relatorios key={caminho} tipoInicial={tiposRelatorio[caminho]}/></Layout>;
  }
  if (caminho === ROTAS.dashboardGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Dashboard />
      </GestorLayout>
    );
  }

  // Telas de Veículos e Motoristas do Gestor de Frota
  if (caminho === ROTAS.veiculosGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Link className="btn btn--secundario relatorio-atalho" para={ROTAS.relatorioVeiculos}>Relatório de veículos</Link>
        <Veiculos />
      </GestorLayout>
    );
  }
  const historicoVeiculoId = lerRotaHistoricoAbastecimentosVeiculo(caminho);

  if (historicoVeiculoId !== null) {
    return (
      <GestorLayout usuario={sessao}>
        <HistoricoAbastecimentos
          key={historicoVeiculoId}
          veiculoId={historicoVeiculoId}
        />
      </GestorLayout>
    );
  }

  if (caminho === ROTAS.motoristasGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Link className="btn btn--secundario relatorio-atalho" para={ROTAS.relatorioMotoristas}>Relatório de motoristas</Link>
        <Motoristas />
      </GestorLayout>
    );
  }

  // ===== Solicitações e Calendário do Gestor de Frota =====
  if (caminho === ROTAS.abastecimentosGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Link className="btn btn--secundario relatorio-atalho" para={ROTAS.relatorioAbastecimentos}>Relatório de abastecimentos</Link>
        <Abastecimentos />
      </GestorLayout>
    );
  }
  if (caminho === ROTAS.indicadoresAbastecimentosGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <IndicadoresAbastecimentos />
      </GestorLayout>
    );
  }

  const abastecimentoId = lerRotaDetalheAbastecimento(caminho);

  if (abastecimentoId !== null) {
    return (
      <GestorLayout usuario={sessao}>
        <DetalheAbastecimento key={abastecimentoId} id={abastecimentoId} />
      </GestorLayout>
    );
  }

  if (caminho === ROTAS.solicitacoesGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Link className="btn btn--secundario relatorio-atalho" para={ROTAS.relatorioSolicitacoes}>Relatório de solicitações</Link>
        <Solicitacoes />
      </GestorLayout>
    );
  }

  if (caminho === ROTAS.calendarioGestor) {
    return (
      <GestorLayout usuario={sessao}>
        <Calendario />
      </GestorLayout>
    );
  }

  // /gestor/solicitacoes/:id e /gestor/solicitacoes/:id/editar
  const rotaGestor = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor);
  if (rotaGestor) {
    return (
      <GestorLayout usuario={sessao}>
        {rotaGestor.editar ? (
          <EditarSolicitacao
            key={caminho}
            id={rotaGestor.id}
            perfil="gestor"
            base={ROTAS.solicitacoesGestor}
          />
        ) : (
          <DetalheSolicitacao
            key={caminho}
            id={rotaGestor.id}
            perfil="gestor"
            base={ROTAS.solicitacoesGestor}
            rotuloVoltar="Solicitações"
            autor={{
              nome: sessao.nome ?? sessao.email ?? "Gestor",
              cargo: "Gestor de Frota",
            }}
          />
        )}
      </GestorLayout>
    );
  }

  // ===== Telas do Solicitante =====
  if (caminho === ROTAS.novaSolicitacao) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <NovaSolicitacao usuario={sessao} />
      </SolicitanteLayout>
    );
  }

  if (caminho === ROTAS.minhasSolicitacoes) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <MinhasSolicitacoes usuario={sessao} />
      </SolicitanteLayout>
    );
  }

  // /solicitante/minhas-solicitacoes/:id e /:id/editar
  const rotaSolicitante = lerRotaSolicitacao(caminho, ROTAS.minhasSolicitacoes);
  if (rotaSolicitante) {
    return (
      <SolicitanteLayout usuario={sessao}>
        {rotaSolicitante.editar ? (
          <EditarSolicitacao
            key={caminho}
            id={rotaSolicitante.id}
            perfil="solicitante"
            base={ROTAS.minhasSolicitacoes}
          />
        ) : (
          <DetalheSolicitacao
            key={caminho}
            id={rotaSolicitante.id}
            perfil="solicitante"
            base={ROTAS.minhasSolicitacoes}
            rotuloVoltar="Minhas Solicitações"
            autor={{
              nome: sessao.nome ?? sessao.email ?? "Solicitante",
              cargo: "Solicitante",
            }}
          />
        )}
      </SolicitanteLayout>
    );
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
  const Pagina = paginas[caminho] ?? DashboardAdmin;

  return (
    <AdminLayout usuario={sessao}>
      <Pagina />
    </AdminLayout>
  );
}
