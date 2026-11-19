
// App do perfil Administrador e Gestor de Frota.
import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentType } from "react";

import { NotificacoesProvider } from "../features/notificacoes/NotificacoesContext";
import "../shared/styles/tema.css";
import "../shared/styles/hierarquia.css";

import { Link, navegar, useCaminho } from "./routes/router";
import {
  ROTAS,
  lerDetalheSvo,
  lerRotaDetalheAbastecimento,
  lerRotaHistoricoAbastecimentosVeiculo,
  lerRotaSolicitacao,
} from "./routes/rotas";
import { AuthSkeleton } from "./AuthSkeleton";

import { AdminLayout } from "../layouts/administrador/AdminLayout";
import { GestorLayout } from "../layouts/gestor/GestorLayout";
import { SvoLayout } from "../layouts/svo/SvoLayout";
import { SolicitanteLayout } from "../layouts/solicitante/SolicitanteLayout";

import { perfilPodeAcessar } from "../shared/services/access.service";
import {
  buscarSessao,
  destinoDoPerfil,
  obterToken,
  sair,
} from "../shared/services/auth.service";
import type { UsuarioSessao } from "../shared/services/auth.service";

import type { ConsultaRelatorio } from "../shared/services/relatorios.service";
import { telaPreviewSvo } from "../features/svo/preview";

// Notificações
const Notificacoes = lazy(() =>
  import("../features/notificacoes/Notificacoes").then((module) => ({
    default: module.Notificacoes,
  })),
);

// Páginas administrativas
const Login = lazy(() =>
  import("../pages/login/Login").then((module) => ({
    default: module.Login,
  })),
);

const DashboardAdmin = lazy(() =>
  import("../pages/administrador/DashboardAdm").then((module) => ({
    default: module.DashboardAdmin,
  })),
);

const Configuracoes = lazy(() =>
  import("../pages/administrador/Configuracoes").then((module) => ({
    default: module.Configuracoes,
  })),
);

const Auditoria = lazy(() =>
  import("../pages/administrador/Auditoria").then((module) => ({
    default: module.Auditoria,
  })),
);

const DocumentosAdm = lazy(() =>
  import("../pages/administrador/DocumentosAdm").then((module) => ({
    default: module.DocumentosAdm,
  })),
);

// Páginas do Gestor
const Dashboard = lazy(() =>
  import("../pages/gerente/DashboardGestor").then((module) => ({
    default: module.Dashboard,
  })),
);

const DocumentosGestor = lazy(() =>
  import("../pages/gerente/DocumentosGestor").then((module) => ({
    default: module.DocumentosGestor,
  })),
);

const Veiculos = lazy(() =>
  import("../pages/veiculos/Veiculos").then((module) => ({
    default: module.Veiculos,
  })),
);

const Motoristas = lazy(() =>
  import("../pages/motorista/Motoristas").then((module) => ({
    default: module.Motoristas,
  })),
);

const Abastecimentos = lazy(() =>
  import("../pages/abastecimentos/Abastecimentos").then((module) => ({
    default: module.Abastecimentos,
  })),
);

const Relatorios = lazy(() =>
  import("../features/relatorios/Relatorios").then((module) => ({
    default: module.Relatorios,
  })),
);

const DetalheAbastecimento = lazy(() =>
  import("../pages/abastecimentos/DetalheAbastecimento").then((module) => ({
    default: module.DetalheAbastecimento,
  })),
);

const HistoricoAbastecimentos = lazy(() =>
  import("../pages/abastecimentos/HistoricoAbastecimentos").then((module) => ({
    default: module.HistoricoAbastecimentos,
  })),
);

const IndicadoresAbastecimentos = lazy(() =>
  import("../pages/abastecimentos/IndicadoresAbastecimentos").then(
    (module) => ({
      default: module.IndicadoresAbastecimentos,
    }),
  ),
);

// Solicitações
const Solicitacoes = lazy(() =>
  import("../pages/gerente/Solicitacoes").then((module) => ({
    default: module.Solicitacoes,
  })),
);

const Calendario = lazy(() =>
  import("../pages/gerente/Calendario").then((module) => ({
    default: module.Calendario,
  })),
);

const NovaSolicitacao = lazy(() =>
  import("../pages/solicitante/NovaSolicitacao").then((module) => ({
    default: module.NovaSolicitacao,
  })),
);

const MinhasSolicitacoes = lazy(() =>
  import("../pages/solicitante/MinhasSolicitacoes").then((module) => ({
    default: module.MinhasSolicitacoes,
  })),
);

const DetalheSolicitacao = lazy(() =>
  import("../features/solicitacoes/DetalheSolicitacao").then((module) => ({
    default: module.DetalheSolicitacao,
  })),
);

const EditarSolicitacao = lazy(() =>
  import("../features/solicitacoes/EditarSolicitacao").then((module) => ({
    default: module.EditarSolicitacao,
  })),
);

// SVO
const MinhasOrdensSvo = lazy(() =>
  import("../features/svo/EquipeSvo").then((module) => ({
    default: module.MinhasOrdensSvo,
  })),
);

const ExecucaoSvo = lazy(() =>
  import("../features/svo/EquipeSvo").then((module) => ({
    default: module.ExecucaoSvo,
  })),
);

const DetalheSolicitacaoSvo = lazy(() =>
  import("../features/svo/DetalhesSvo").then((module) => ({
    default: module.DetalheSolicitacao,
  })),
);

const DetalheOrdem = lazy(() =>
  import("../features/svo/DetalhesSvo").then((module) => ({
    default: module.DetalheOrdem,
  })),
);

const Svo = lazy(() =>
  import("../features/svo/Svo").then((module) => ({
    default: module.Svo,
  })),
);

const CadastroSolicitacaoSvo = lazy(() =>
  import("../features/svo/SvoOperacional").then((module) => ({
    default: module.CadastroSolicitacaoSvo,
  })),
);

const ListaOrdensIntegrada = lazy(() =>
  import("../features/svo/SvoOperacional").then((module) => ({
    default: module.ListaOrdensIntegrada,
  })),
);

const ListaSolicitacoesIntegrada = lazy(() =>
  import("../features/svo/SvoOperacional").then((module) => ({
    default: module.ListaSolicitacoesIntegrada,
  })),
);

const TriagemSvo = lazy(() =>
  import("../features/svo/SvoOperacional").then((module) => ({
    default: module.TriagemSvo,
  })),
);

// Páginas administrativas associadas diretamente às rotas
const paginas: Record<string, ComponentType> = {
  [ROTAS.dashboard]: DashboardAdmin,
  [ROTAS.configuracoes]: Configuracoes,
  [ROTAS.auditoria]: Auditoria,
  [ROTAS.documentosAdm]: DocumentosAdm,
};

/** Confirma a sessão da rota atual antes de montar qualquer página protegida. */
export function App() {
  const caminho = useCaminho();
  const token = obterToken();

  const [confirmacao, setConfirmacao] = useState<{
    caminho: string;
    token: string;
    perfil: string;
  } | null>(null);

  const ativo = Boolean(
    token &&
      caminho !== ROTAS.login &&
      confirmacao?.token === token &&
      confirmacao.caminho === caminho &&
      perfilPodeAcessar(caminho, confirmacao.perfil),
  );

  return (
    <NotificacoesProvider key={token ?? "sem-sessao"} ativo={ativo}>
      <Suspense
        fallback={
          <div role="status" className="conteudo">
            Carregando página…
          </div>
        }
      >
        <AppContent onSessaoConfirmada={setConfirmacao} />
      </Suspense>
    </NotificacoesProvider>
  );
}

function AppContent({
  onSessaoConfirmada,
}: {
  onSessaoConfirmada: (
    confirmacao: {
      caminho: string;
      token: string;
      perfil: string;
    } | null,
  ) => void;
}) {
  const caminho = useCaminho();

  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);

  const [caminhoVerificado, setCaminhoVerificado] = useState<string | null>(
    null,
  );

  const previewSvo =
    import.meta.env.DEV && telaPreviewSvo(caminho) !== null;

  useEffect(() => {
    let ativa = true;

    if (previewSvo) {
      window.location.reload();

      return () => {
        ativa = false;
      };
    }

    const tokenAoIniciar = obterToken();

    if (!tokenAoIniciar) {
      onSessaoConfirmada(null);
      sair();
      setSessao(null);
      setCaminhoVerificado(null);

      if (caminho !== ROTAS.login) {
        navegar(ROTAS.login, true);
      }

      return () => {
        ativa = false;
      };
    }

    setCaminhoVerificado(null);

    void buscarSessao()
      .then((usuario) => {
        if (!ativa || obterToken() !== tokenAoIniciar) return;

        onSessaoConfirmada(
          usuario
            ? {
                caminho,
                token: tokenAoIniciar,
                perfil: usuario.perfil,
              }
            : null,
        );

        setSessao(usuario);
        setCaminhoVerificado(caminho);

        if (!usuario) {
          sair();

          if (caminho !== ROTAS.login) {
            navegar(ROTAS.login, true);
          }

          return;
        }

        if (
          caminho.startsWith("/svo/") &&
          ["ATENDENTE_SVO", "MOTORISTA"].includes(usuario.perfil)
        ) {
          return;
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
      })
      .catch(() => {
        if (!ativa || obterToken() !== tokenAoIniciar) return;

        onSessaoConfirmada(null);
        sair();
        setSessao(null);
        setCaminhoVerificado(null);
        navegar(ROTAS.login, true);
      });

    return () => {
      ativa = false;
    };
  }, [caminho, previewSvo, onSessaoConfirmada]);

  if (previewSvo) return null;

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />;
  }

  if (!obterToken()) {
    return <Login />;
  }

  // Acesso especial às telas do SVO
  if (
    caminhoVerificado === caminho &&
    sessao &&
    caminho.startsWith("/svo/") &&
    ["ATENDENTE_SVO", "MOTORISTA"].includes(sessao.perfil) &&
    !perfilPodeAcessar(caminho, sessao.perfil)
  ) {
    const conhecida =
      Object.values(ROTAS).some((rota) => rota === caminho) ||
      lerDetalheSvo(caminho);

    return (
      <SvoLayout usuario={sessao}>
        <h1>
          {conhecida ? "Acesso negado" : "Página não encontrada"}
        </h1>

        <p role="alert">
          {conhecida
            ? "Seu perfil não tem acesso a esta página."
            : "Confira o endereço da página."}
        </p>

        <Link
          className="svo-atalho"
          para={destinoDoPerfil(sessao.perfil)}
        >
          Voltar ao início
        </Link>
      </SvoLayout>
    );
  }

  // Enquanto a sessão é confirmada, mantém o layout correspondente ao perfil.
  if (
    caminhoVerificado !== caminho ||
    !sessao ||
    !perfilPodeAcessar(caminho, sessao.perfil)
  ) {
    if (
      sessao &&
      perfilPodeAcessar(caminho, sessao.perfil) &&
      caminho.startsWith("/gestor/")
    ) {
      const LayoutCarregamento =
        sessao.perfil === "ADM" ? AdminLayout : GestorLayout;

      return (
        <LayoutCarregamento usuario={sessao}>
          <AuthSkeleton caminho={caminho} somenteConteudo />
        </LayoutCarregamento>
      );
    }

    return <AuthSkeleton caminho={caminho} />;
  }

  // Layout operacional: ADM usa AdminLayout; Gestor usa GestorLayout.
  const LayoutOperacional =
    sessao.perfil === "ADM" ? AdminLayout : GestorLayout;

  // Notificações
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

  // Relatórios
  const tiposRelatorio: Record<string, ConsultaRelatorio["tipo"]> = {
    [ROTAS.relatoriosGestor]: "viagens",
    [ROTAS.relatorioVeiculos]: "veiculos",
    [ROTAS.relatorioMotoristas]: "motoristas",
    [ROTAS.relatorioSolicitacoes]: "solicitacoes",
    [ROTAS.relatorioAbastecimentos]: "abastecimentos",
    [ROTAS.svoRelatorios]: "svo",
  };

  if (tiposRelatorio[caminho]) {
    const Layout =
      caminho === ROTAS.svoRelatorios
        ? SvoLayout
        : LayoutOperacional;

    return (
      <Layout usuario={sessao}>
        <Relatorios
          key={caminho}
          tipoInicial={tiposRelatorio[caminho]}
        />
      </Layout>
    );
  }

  // Dashboard do Gestor
  if (caminho === ROTAS.dashboardGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Dashboard />
      </LayoutOperacional>
    );
  }

  // Documentos do Gestor
  if (caminho === ROTAS.documentosGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <DocumentosGestor />
      </LayoutOperacional>
    );
  }

  // Veículos
  if (caminho === ROTAS.veiculosGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Link
          className="btn btn--secundario relatorio-atalho"
          para={ROTAS.relatorioVeiculos}
        >
          Relatório de veículos
        </Link>

        <Veiculos />
      </LayoutOperacional>
    );
  }

  // Histórico de abastecimentos por veículo
  const historicoVeiculoId =
    lerRotaHistoricoAbastecimentosVeiculo(caminho);

  if (historicoVeiculoId !== null) {
    return (
      <LayoutOperacional usuario={sessao}>
        <HistoricoAbastecimentos
          key={historicoVeiculoId}
          veiculoId={historicoVeiculoId}
        />
      </LayoutOperacional>
    );
  }

  // Motoristas
  if (caminho === ROTAS.motoristasGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Link
          className="btn btn--secundario relatorio-atalho"
          para={ROTAS.relatorioMotoristas}
        >
          Relatório de motoristas
        </Link>

        <Motoristas />
      </LayoutOperacional>
    );
  }

  // Abastecimentos
  if (caminho === ROTAS.abastecimentosGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Link
          className="btn btn--secundario relatorio-atalho"
          para={ROTAS.relatorioAbastecimentos}
        >
          Relatório de abastecimentos
        </Link>

        <Abastecimentos />
      </LayoutOperacional>
    );
  }

  // Indicadores de abastecimentos
  if (caminho === ROTAS.indicadoresAbastecimentosGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <IndicadoresAbastecimentos />
      </LayoutOperacional>
    );
  }

  // Detalhe de abastecimento
  const abastecimentoId = lerRotaDetalheAbastecimento(caminho);

  if (abastecimentoId !== null) {
    return (
      <LayoutOperacional usuario={sessao}>
        <DetalheAbastecimento
          key={abastecimentoId}
          id={abastecimentoId}
        />
      </LayoutOperacional>
    );
  }

  // Solicitações do Gestor
  if (caminho === ROTAS.solicitacoesGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Link
          className="btn btn--secundario relatorio-atalho"
          para={ROTAS.relatorioSolicitacoes}
        >
          Relatório de solicitações
        </Link>

        <Solicitacoes />
      </LayoutOperacional>
    );
  }

  // Calendário do Gestor
  if (caminho === ROTAS.calendarioGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
        <Calendario />
      </LayoutOperacional>
    );
  }

  // /gestor/solicitacoes/:id e /gestor/solicitacoes/:id/editar
  const rotaGestor = lerRotaSolicitacao(
    caminho,
    ROTAS.solicitacoesGestor,
  );

  if (rotaGestor) {
    return (
      <LayoutOperacional usuario={sessao}>
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
      </LayoutOperacional>
    );
  }

  // Nova Solicitação do Solicitante
  if (caminho === ROTAS.novaSolicitacao) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <NovaSolicitacao usuario={sessao} />
      </SolicitanteLayout>
    );
  }

  // Minhas Solicitações
  if (caminho === ROTAS.minhasSolicitacoes) {
    return (
      <SolicitanteLayout usuario={sessao}>
        <MinhasSolicitacoes usuario={sessao} />
      </SolicitanteLayout>
    );
  }

  // /solicitante/minhas-solicitacoes/:id e /:id/editar
  const rotaSolicitante = lerRotaSolicitacao(
    caminho,
    ROTAS.minhasSolicitacoes,
  );

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

  // Telas do SVO
  const detalhe = lerDetalheSvo(caminho);

  const paginasSvo: Record<string, ComponentType> = {
    [ROTAS.svoNovaSolicitacao]: CadastroSolicitacaoSvo,
    [ROTAS.svoSolicitacoes]: ListaSolicitacoesIntegrada,
    [ROTAS.svoOrdens]: ListaOrdensIntegrada,
    [ROTAS.svoMinhasOrdens]: MinhasOrdensSvo,
  };

  const PaginaSvo = paginasSvo[caminho];

  if (PaginaSvo) {
    return (
      <SvoLayout usuario={sessao}>
        <PaginaSvo key={caminho} />
      </SvoLayout>
    );
  }

  if (detalhe) {
    const { id, tela } = detalhe;

    return (
      <SvoLayout usuario={sessao} key={caminho}>
        {tela === "solicitacao" && (
          <DetalheSolicitacaoSvo id={id} />
        )}

        {tela === "triagem" && <TriagemSvo id={id} />}

        {tela === "ordem" && <DetalheOrdem id={id} />}

        {tela === "execucao" && (
          <ExecucaoSvo
            id={id}
            motorista={sessao.nome ?? "#" + sessao.id}
          />
        )}
      </SvoLayout>
    );
  }

  if (
    caminho === ROTAS.svoRaiz ||
    caminho === ROTAS.svoDashboard
  ) {
    return (
      <SvoLayout usuario={sessao}>
        <Svo />
      </SvoLayout>
    );
  }

  // Páginas administrativas, incluindo Documentos do ADM
  const Pagina = paginas[caminho];

  if (Pagina) {
    return (
      <AdminLayout usuario={sessao}>
        <Pagina />
      </AdminLayout>
    );
  }

  // Rota não encontrada: não abre mais o Dashboard por engano.
  return (
    <LayoutOperacional usuario={sessao}>
      <h1>Página não encontrada</h1>
      <p role="alert">
        Não encontramos uma página para este endereço.
      </p>
      <Link para={destinoDoPerfil(sessao.perfil)}>
        Voltar ao início
      </Link>
    </LayoutOperacional>
  );
}
