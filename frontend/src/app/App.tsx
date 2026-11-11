// App do perfil Administrador e Gestor de Frota.
import { useEffect, useState } from "react";
import { NotificacoesProvider } from "../features/notificacoes/NotificacoesContext";
import { Notificacoes } from "../features/notificacoes/Notificacoes";
import type { ComponentType } from "react";
import "../shared/styles/tema.css";

import { navegar, useCaminho } from "./routes/router";
import {
  ROTAS,
  lerRotaSolicitacao,
  lerRotaDetalheAbastecimento,
  lerRotaHistoricoAbastecimentosVeiculo,
} from "./routes/rotas";
import { AuthSkeleton } from "./AuthSkeleton";

import { AdminLayout } from "../layouts/administrador/AdminLayout";
import { perfilPodeAcessar } from "../shared/services/access.service";
import { GestorLayout } from "../layouts/gestor/GestorLayout";
import { SolicitanteLayout } from "../layouts/solicitante/SolicitanteLayout";

import { Login } from "../pages/login/Login";
import { DashboardAdmin } from "../pages/administrador/DashboardAdm";
import { Configuracoes } from "../pages/administrador/Configuracoes";
import { Auditoria } from "../pages/administrador/Auditoria";
import { Dashboard } from "../pages/gerente/DashboardGestor";
import { Veiculos } from "../pages/veiculos/Veiculos";
import { Motoristas } from "../pages/motorista/Motoristas";
import { Abastecimentos } from "../pages/abastecimentos/Abastecimentos";
import { DetalheAbastecimento } from "../pages/abastecimentos/DetalheAbastecimento";
import { HistoricoAbastecimentos } from "../pages/abastecimentos/HistoricoAbastecimentos";
import { IndicadoresAbastecimentos } from "../pages/abastecimentos/IndicadoresAbastecimentos";

import { Svo } from "../features/svo/Svo";
import { Solicitacoes } from "../pages/gerente/Solicitacoes";
import { Calendario } from "../pages/gerente/Calendario";
import { NovaSolicitacao } from "../pages/solicitante/NovaSolicitacao";
import { MinhasSolicitacoes } from "../pages/solicitante/MinhasSolicitacoes";
import { DetalheSolicitacao } from "../features/solicitacoes/DetalheSolicitacao";
import { EditarSolicitacao } from "../features/solicitacoes/EditarSolicitacao";
import {
  buscarSessao,
  destinoDoPerfil,
  obterToken,
  sair,
} from "../shared/services/auth.service";
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
      <AppContent />
    </NotificacoesProvider>
  );
}

function AppContent() {
  const caminho = useCaminho();
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [caminhoVerificado, setCaminhoVerificado] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let ativa = true;

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
          sair();
          if (caminho !== ROTAS.login) navegar(ROTAS.login, true);
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
        if (!ativa) return;
        sair();
        setSessao(null);
        setCaminhoVerificado(null);
        navegar(ROTAS.login, true);
      });

    return () => {
      ativa = false;
    };
  }, [caminho]);

  // Tela de login
  if (caminho === ROTAS.login) {
    return <Login />;
  }

  if (!obterToken()) {
    return <Login />;
  }

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
      return (
        <GestorLayout usuario={sessao}>
          <AuthSkeleton caminho={caminho} somenteConteudo />
        </GestorLayout>
      );
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
        <Motoristas />
      </GestorLayout>
    );
  }

  // ===== Solicitações e Calendário do Gestor de Frota =====
  if (caminho === ROTAS.abastecimentosGestor) {
    return (
      <GestorLayout usuario={sessao}>
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
  if (caminho === "/svo") {
    return (
      <GestorLayout usuario={sessao}>
        <Svo />
      </GestorLayout>
    );
  }

  // Telas do Administrador e fallback
  const Pagina = paginas[caminho] ?? DashboardAdmin;

  return (
    <AdminLayout usuario={sessao}>
      <Pagina />
    </AdminLayout>
  );
}
