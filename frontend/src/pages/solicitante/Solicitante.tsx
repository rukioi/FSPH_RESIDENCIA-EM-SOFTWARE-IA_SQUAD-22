import { useState } from "react";
import MinhasSolicitacoes, {
  type Solicitacao,
} from "../../features/solicitacoes/MinhasSolicitacoes";
import "./Solicitante.css";

type IconName = "car" | "plus" | "list" | "bell" | "logout" | "chevron";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "car":
      return (
        <svg {...common}>
          <path d="M5 17h14l1-6-2-5H6l-2 5 1 6Z" />
          <path d="M6 11h12M7 17v2m10-2v2M7 14h.01M17 14h.01" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      );
    default:
      return null;
  }
}

function IconeViagem({
  tipo,
}: {
  tipo: "calendario" | "relogio" | "local" | "pessoa" | "veiculo";
}) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (tipo) {
    case "calendario":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
        </svg>
      );
    case "relogio":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "local":
      return (
        <svg {...props}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "pessoa":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      );
    case "veiculo":
      return (
        <svg {...props}>
          <path d="M5 17h14l1-6-2-5H6l-2 5 1 6Z" />
          <path d="M6 11h12M7 17v2m10-2v2M7 14h.01M17 14h.01" />
        </svg>
      );
    default:
      return null;
  }
}

interface DetalhesSolicitacaoProps {
  solicitacao: Solicitacao;
  onVoltar: () => void;
}

function obterClasseStatus(status: Solicitacao["status"]): string {
  switch (status) {
    case "Pendente":
      return "pendente";
    case "Agendada":
      return "agendada";
    case "Aprovada":
      return "aprovada";
    case "Recusada":
      return "recusada";
    case "Em andamento":
      return "em-andamento";
    case "Concluída":
      return "concluida";
  }
}

function DetalhesSolicitacao({
  solicitacao,
  onVoltar,
}: DetalhesSolicitacaoProps) {
  const etapasPadrao = [
    "Solicitação registrada",
    "Aguardando análise",
    "Aprovada",
    "Agendada",
    "Em andamento",
    "Concluída",
  ];

  const etapas = solicitacao.status === "Recusada"
    ? [
        { nome: "Solicitação registrada", estado: "futura" },
        { nome: "Solicitação recusada", estado: "recusada" },
        { nome: "Aprovada", estado: "futura" },
        { nome: "Agendada", estado: "futura" },
        { nome: "Em andamento", estado: "futura" },
        { nome: "Concluída", estado: "futura" },
      ]
    : etapasPadrao.map((nome, indice) => {
        const indiceAtual: Record<Solicitacao["status"], number> = {
          Pendente: 1,
          Aprovada: 2,
          Agendada: 3,
          "Em andamento": 4,
          "Concluída": 5,
          Recusada: 1,
        };

        const atual = indiceAtual[solicitacao.status];
        const estado =
          indice < atual ? "concluida" : indice === atual ? "atual" : "futura";

        return { nome, estado };
      });

  const campos: {
    rotulo: string;
    valor?: string;
    largo?: boolean;
  }[] = [
    { rotulo: "Instituição", valor: solicitacao.instituicao },
    { rotulo: "Solicitante", valor: solicitacao.solicitante },
    { rotulo: "Data", valor: solicitacao.data },
    { rotulo: "Horário", valor: solicitacao.horario },
    { rotulo: "Origem", valor: solicitacao.origem },
    { rotulo: "Destino", valor: solicitacao.destino },
    {
      rotulo: "Quantidade de passageiros",
      valor:
        solicitacao.quantidadePassageiros !== undefined
          ? String(solicitacao.quantidadePassageiros)
          : undefined,
    },
    { rotulo: "Finalidade", valor: solicitacao.finalidade, largo: true },
    { rotulo: "Observações", valor: solicitacao.observacoes, largo: true },
    { rotulo: "Data de criação", valor: solicitacao.criadaEm, largo: true },
    { rotulo: "Documentos ou objetos", valor: solicitacao.documentos, largo: true },
  ];

  return (
    <section className="detalhes">
      <button className="detalhes__voltar" type="button" onClick={onVoltar}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6M9 12h12" />
        </svg>
        Voltar
      </button>

      <header className="detalhes__cabecalho">
        <div>
          <h2>Solicitação #{solicitacao.ticket}</h2>
          <p>Criada em {solicitacao.criadaEm || "Data não informada"}</p>
        </div>

        <span
          className={`detalhes__status detalhes__status--${obterClasseStatus(
            solicitacao.status
          )}`}
        >
          {solicitacao.status}
        </span>
      </header>

      {solicitacao.status === "Recusada" && (
        <section className="detalhes__recusa" role="alert">
          <span className="detalhes__recusa-icone" aria-hidden="true">
            ×
          </span>
          <div>
            <strong>Solicitação recusada</strong>
            <b>Motivo da recusa:</b>
            <p>
              {solicitacao.motivoRecusa ||
                "O motivo da recusa não foi informado."}
            </p>
          </div>
        </section>
      )}

      <div className="detalhes__grade">
        <section className="detalhes__cartao">
          <h3>Dados da solicitação</h3>

          <dl className="detalhes__campos">
            {campos
              .filter((campo) => campo.valor)
              .map((campo) => (
                <div
                  className={`detalhes__campo ${
                    campo.largo ? "detalhes__campo--largo" : ""
                  }`}
                  key={campo.rotulo}
                >
                  <dt>{campo.rotulo}</dt>
                  <dd>{campo.valor}</dd>
                </div>
              ))}
          </dl>
        </section>

        <section className="detalhes__cartao">
          <h3>Andamento da solicitação</h3>

          <ol className="detalhes__etapas">
            {etapas.map((etapa) => (
              <li
                className={`detalhes__etapa detalhes__etapa--${etapa.estado}`}
                key={etapa.nome}
              >
                <span className="detalhes__marcador" aria-hidden="true">
                  {etapa.estado === "concluida" ? "✓" : ""}
                  {etapa.estado === "recusada" ? "×" : ""}
                </span>

                <div>
                  <span className="detalhes__nome-etapa">{etapa.nome}</span>
                  {etapa.estado === "atual" && (
                    <small className="detalhes__legenda-atual">
                      Status atual
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {(solicitacao.motorista || solicitacao.veiculo) && (
        <section className="detalhes__viagem">
          <h3 className="detalhes__viagem-titulo">
            <IconeViagem tipo="veiculo" />
            Informações da viagem
          </h3>

          <div className="detalhes__viagem-itens">
            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="calendario" />
              </span>
              <div>
                <small>Data</small>
                <strong>{solicitacao.data}</strong>
              </div>
            </div>

            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="relogio" />
              </span>
              <div>
                <small>Horário</small>
                <strong>{solicitacao.horario}</strong>
              </div>
            </div>

            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="local" />
              </span>
              <div>
                <small>Origem</small>
                <strong>{solicitacao.origem || "Não informado"}</strong>
              </div>
            </div>

            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="local" />
              </span>
              <div>
                <small>Destino</small>
                <strong>{solicitacao.destino}</strong>
              </div>
            </div>

            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="pessoa" />
              </span>
              <div>
                <small>Motorista</small>
                <strong>{solicitacao.motorista || "Não informado"}</strong>
              </div>
            </div>

            <div className="detalhes__viagem-item">
              <span className="detalhes__viagem-icone">
                <IconeViagem tipo="veiculo" />
              </span>
              <div>
                <small>Veículo</small>
                <strong>{solicitacao.veiculo || "Não informado"}</strong>
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

export default function Solicitante() {
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] =
    useState<Solicitacao | null>(null);

  return (
    <div
      className={`dashboard ${
        menuRecolhido ? "dashboard--recolhido" : ""
      }`}
    >
      <aside className="sidebar">
        <div className="sidebar__marca">
          <span className="sidebar__icone-marca">
            <Icon name="car" />
          </span>

          <div className="sidebar__texto-marca">
            <strong>Gestão de Frotas</strong>
            <small>Central de Transporte</small>
          </div>
        </div>

        <button
          className="sidebar__recolher"
          type="button"
          aria-label={menuRecolhido ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!menuRecolhido}
          onClick={() => setMenuRecolhido((atual) => !atual)}
        >
          <Icon name="chevron" />
        </button>

        <nav className="sidebar__navegacao" aria-label="Menu principal">
          <a className="sidebar__item" href="#nova-solicitacao">
            <Icon name="plus" />
            <span>Nova Solicitação</span>
          </a>

          <a
            className="sidebar__item sidebar__item--ativo"
            href="#minhas-solicitacoes"
            aria-current="page"
          >
            <Icon name="list" />
            <span>Minhas Solicitações</span>
          </a>

          <a className="sidebar__item" href="#notificacoes">
            <Icon name="bell" />
            <span>Notificações</span>
          </a>
        </nav>

        <div className="sidebar__rodape">
          <div className="sidebar__usuario">
            <span className="avatar">MS</span>

            <div className="sidebar__dados-usuario">
              <strong>Mariana Santos</strong>
              <small>Hemose · Solicitante</small>
            </div>
          </div>

          <a className="sidebar__item sidebar__sair" href="#sair">
            <Icon name="logout" />
            <span>Sair</span>
          </a>
        </div>
      </aside>

      <div className="dashboard__principal">
        <header className="topbar">
          <h1>
            {solicitacaoSelecionada
              ? `Detalhes do ticket #${solicitacaoSelecionada.ticket}`
              : "Minhas solicitações"}
          </h1>

          <div className="topbar__usuario">
            <button
              className="topbar__notificacoes"
              type="button"
              aria-label="Notificações"
            >
              <Icon name="bell" />
              <span className="topbar__ponto" />
            </button>

            <div className="topbar__dados">
              <strong>Mariana Santos</strong>
              <small>Hemose</small>
            </div>

            <span className="avatar avatar--topo">MS</span>
          </div>
        </header>

        <main className="dashboard__conteudo">
          {solicitacaoSelecionada ? (
            <DetalhesSolicitacao
              solicitacao={solicitacaoSelecionada}
              onVoltar={() => setSolicitacaoSelecionada(null)}
            />
          ) : (
            <MinhasSolicitacoes
              onVerDetalhes={setSolicitacaoSelecionada}
            />
          )}
        </main>
      </div>
    </div>
  );
}
