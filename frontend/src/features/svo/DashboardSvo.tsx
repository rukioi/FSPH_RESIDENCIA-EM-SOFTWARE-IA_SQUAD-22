import { useState } from "react";
import {
  AguardandoDespacho,
  type OrdemColeta,
} from "./AguardandoDespacho";
import { OrdensColetaRecentes, type ConsultaRecentes } from "./OrdensColetaRecentes";
import { PrepararDespachoModal } from "./PrepararDespachoModal";
import { ResumoDashboardSvo } from './ResumoDashboardSvo';
import type { RecursosDisponiveisSvo } from "../../shared/types/svo";
import "./DashboardSvo.css";
import { navegar } from '../../app/routes/router';
import { ROTAS } from '../../app/routes/rotas';

type DashboardSvoProps = {
  ordensAguardando: OrdemColeta[];
  recentes: ConsultaRecentes;
  erroOrdens: string;
  erroRecursos: string;
  carregandoRecursos: boolean;
  onAtualizarRecursos: () => void;
  carregando: boolean;
  onTentarNovamente: () => void;
  motoristas: RecursosDisponiveisSvo['motoristas'];
  veiculos: RecursosDisponiveisSvo['veiculos'];
  onConfirmarDespacho: (
    ordem: OrdemColeta,
    motoristaId: number,
    veiculoId: number,
  ) => void | Promise<void>;
};

/** Mantém o despacho existente e apresenta agregações oficiais da SCRUM-149. */
export function DashboardSvo({
  ordensAguardando,
  recentes,
  erroOrdens,
  erroRecursos,
  carregandoRecursos,
  onAtualizarRecursos,
  carregando,
  onTentarNovamente,
  motoristas,
  veiculos,
  onConfirmarDespacho,
}: DashboardSvoProps) {
  const [ordemSelecionada, setOrdemSelecionada] =
    useState<OrdemColeta | null>(null);
  const [revisao, setRevisao] = useState(0);

  async function confirmarDespacho(
    motoristaId: number,
    veiculoId: number,
  ) {
    if (!ordemSelecionada) {
      return;
    }

    await onConfirmarDespacho(
      ordemSelecionada,
      motoristaId,
      veiculoId,
    );

    setOrdemSelecionada(null);
    setRevisao(valor => valor + 1);
  }

  return (
    <section className="svo-dashboard">
      <header className="svo-dashboard__cabecalho">
        <div>
          <h1>Dashboard SVO</h1>
          <p>
            Atendimento, filas atuais e indicadores retornados pelo servidor.
          </p>
        </div>

        <button
          type="button"
          className="svo-dashboard__nova-solicitacao"
          onClick={() => navegar(ROTAS.svoNovaSolicitacao)}
        >
          + Nova Solicitação
        </button>
      </header>


      <ResumoDashboardSvo revisao={revisao}/>

      {carregando && <p role="status">Carregando ordens...</p>}
      {erroOrdens && <p role="alert">{erroOrdens}</p>}
      {erroRecursos && <p role="alert">{erroRecursos}</p>}
      {(erroOrdens || erroRecursos) && <button type="button" className="svo-dashboard__tentar-novamente" onClick={onTentarNovamente}>Tentar novamente</button>}
      {!carregando && !erroOrdens && <AguardandoDespacho
        ordens={ordensAguardando}
        erro={erroOrdens}
        onPrepararDespacho={ordem => {setOrdemSelecionada(ordem); onAtualizarRecursos();}}
      />}

      <OrdensColetaRecentes {...recentes} />

      {ordemSelecionada && (
        <PrepararDespachoModal
          ordemId={ordemSelecionada.id}
          ordemApiId={ordemSelecionada.apiId}
          motoristas={motoristas}
          veiculos={veiculos}
          carregandoRecursos={carregandoRecursos}
          erroRecursos={erroRecursos}
          onAtualizarRecursos={onAtualizarRecursos}
          onFechar={() => setOrdemSelecionada(null)}
          onConfirmar={confirmarDespacho}
        />
      )}
    </section>
  );
}
