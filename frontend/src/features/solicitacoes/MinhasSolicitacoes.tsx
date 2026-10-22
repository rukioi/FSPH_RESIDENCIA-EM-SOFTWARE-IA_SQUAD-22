import { useMemo, useState } from "react";
import "./MinhasSolicitacoes.css";
import "./DetalhesSolicitacao.css";

export type Status =
  | "Pendente"
  | "Agendada"
  | "Aprovada"
  | "Recusada"
  | "Em andamento"
  | "Concluída";

export interface Solicitacao {
  ticket: string;
  data: string;
  horario: string;
  destino: string;
  status: Status;
  instituicao?: string;
  solicitante?: string;
  origem?: string;
  quantidadePassageiros?: number;
  finalidade?: string;
  observacoes?: string;
  criadaEm?: string;
  documentos?: string;
  motorista?: string;
  veiculo?: string;
  motivoRecusa?: string;
}

interface MinhasSolicitacoesProps {
  onVerDetalhes: (solicitacao: Solicitacao) => void;
}

const solicitacoes: Solicitacao[] = [
  {
    ticket: "TRP-1044",
    data: "26/09/2026",
    horario: "14:00",
    destino: "Laboratório Central",
    status: "Pendente",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 2,
    finalidade: "Entrega de amostras para análise",
    observacoes: "Material acondicionado conforme protocolo.",
    criadaEm: "22/09/2026 às 09:18",
    documentos: "Caixa térmica com amostras",
  },
  {
    ticket: "TRP-1043",
    data: "25/09/2026",
    horario: "10:15",
    destino: "Secretaria de Estado da Saúde",
    status: "Pendente",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 3,
    finalidade: "Reunião institucional",
    observacoes: "Retorno previsto para 12:30.",
    criadaEm: "21/09/2026 às 16:42",
  },
  {
    ticket: "TRP-1042",
    data: "24/09/2026",
    horario: "08:30",
    destino: "Hospital Universitário",
    status: "Agendada",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 4,
    finalidade: "Visita técnica da equipe",
    observacoes: "A equipe estará no portão principal às 08:20.",
    criadaEm: "19/09/2026 às 11:05",
    motorista: "Carlos Almeida",
    veiculo: "Fiat Cronos • QWE-4D21",
  },
  {
    ticket: "TRP-1041",
    data: "23/09/2026",
    horario: "13:30",
    destino: "Centro Administrativo",
    status: "Aprovada",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 2,
    finalidade: "Entrega e retirada de documentos",
    observacoes: "Aguardar protocolo de recebimento.",
    criadaEm: "18/09/2026 às 14:20",
    documentos: "Dois envelopes lacrados",
  },
  {
    ticket: "TRP-1040",
    data: "22/09/2026",
    horario: "09:00",
    destino: "Unidade de Saúde Farolândia",
    status: "Recusada",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 5,
    finalidade: "Apoio a ação externa",
    observacoes: "Saída pela recepção administrativa.",
    criadaEm: "17/09/2026 às 10:12",
    motivoRecusa:
      "Não há disponibilidade operacional para o horário solicitado. Registre uma nova solicitação para outra data.",
  },
  {
    ticket: "TRP-1039",
    data: "22/09/2026",
    horario: "07:45",
    destino: "Hospital de Urgências",
    status: "Em andamento",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 2,
    finalidade: "Transporte de equipe técnica",
    observacoes: "Atendimento em curso.",
    criadaEm: "16/09/2026 às 08:57",
    motorista: "Ana Ribeiro",
    veiculo: "Renault Duster • RST-8J10",
  },
  {
    ticket: "TRP-1035",
    data: "15/09/2026",
    horario: "11:00",
    destino: "Maternidade Nossa Senhora",
    status: "Concluída",
    instituicao: "Hemose",
    solicitante: "Mariana Santos",
    origem: "Hemose",
    quantidadePassageiros: 3,
    finalidade: "Visita de acompanhamento",
    observacoes: "Atendimento realizado sem intercorrências.",
    criadaEm: "11/09/2026 às 15:33",
    motorista: "Paulo Mendes",
    veiculo: "Chevrolet Spin • QAB-2C34",
  },
];

const statusDisponiveis: Status[] = [
  "Pendente",
  "Agendada",
  "Aprovada",
  "Recusada",
  "Em andamento",
  "Concluída",
];

function dataBrasileiraParaDate(data: string): Date {
  const [dia, mes, ano] = data.split("/").map(Number);
  return new Date(ano, mes - 1, dia);
}

function Icone({
  nome,
}: {
  nome: "mais" | "busca" | "limpar" | "seta";
}) {
  const propriedades = {
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

  switch (nome) {
    case "mais":
      return (
        <svg {...propriedades}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "busca":
      return (
        <svg {...propriedades}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "limpar":
      return (
        <svg {...propriedades}>
          <path d="m18 6-12 12M6 6l12 12" />
        </svg>
      );
    case "seta":
      return (
        <svg {...propriedades}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MinhasSolicitacoes({
  onVerDetalhes,
}: MinhasSolicitacoesProps) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [data, setData] = useState("");

  const solicitacoesFiltradas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return solicitacoes.filter((solicitacao) => {
      const buscaNormalizada = busca.trim().toLowerCase().replace(/^#/, "");

      if (
        buscaNormalizada &&
        !solicitacao.ticket.toLowerCase().includes(buscaNormalizada)
      ) {
        return false;
      }

      if (status && solicitacao.status !== status) {
        return false;
      }

      if (periodo) {
        const dataLimite = new Date(hoje);
        dataLimite.setDate(hoje.getDate() - Number(periodo));

        if (dataBrasileiraParaDate(solicitacao.data) < dataLimite) {
          return false;
        }
      }

      if (data) {
        const [ano, mes, dia] = data.split("-").map(Number);
        const dataSelecionada = new Date(ano, mes - 1, dia);
        const dataSolicitacao = dataBrasileiraParaDate(solicitacao.data);

        if (dataSolicitacao.getTime() !== dataSelecionada.getTime()) {
          return false;
        }
      }

      return true;
    });
  }, [busca, status, periodo, data]);

  function limparFiltros() {
    setBusca("");
    setStatus("");
    setPeriodo("");
    setData("");
  }

  return (
    <section className="solicitacoes">
      <div className="solicitacoes__cabecalho">
        <div>
          <h2>Minhas Solicitações</h2>
          <p>Acompanhe suas solicitações de transporte.</p>
        </div>

        <button className="solicitacoes__botao-nova" type="button">
          <Icone nome="mais" />
          <span>Nova solicitação</span>
        </button>
      </div>

      <section className="solicitacoes__filtros" aria-label="Filtros">
        <label className="solicitacoes__campo solicitacoes__campo--busca">
          <span>Buscar por ticket</span>
          <div className="solicitacoes__entrada solicitacoes__entrada--busca">
            <Icone nome="busca" />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Ex.: TRP-1042"
            />
          </div>
        </label>

        <label className="solicitacoes__campo">
          <span>Status</span>
          <select
            className="solicitacoes__entrada"
            value={status}
            onChange={(evento) => setStatus(evento.target.value)}
          >
            <option value="">Todos os status</option>
            {statusDisponiveis.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </label>

        <label className="solicitacoes__campo">
          <span>Período</span>
          <select
            className="solicitacoes__entrada"
            value={periodo}
            onChange={(evento) => setPeriodo(evento.target.value)}
          >
            <option value="">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </label>

        <label className="solicitacoes__campo">
          <span>Data</span>
          <input
            className="solicitacoes__entrada"
            type="date"
            value={data}
            onChange={(evento) => setData(evento.target.value)}
          />
        </label>

        <button
          className="solicitacoes__botao-limpar"
          type="button"
          onClick={limparFiltros}
        >
          <Icone nome="limpar" />
          <span>Limpar</span>
        </button>
      </section>

      <p className="solicitacoes__contagem" aria-live="polite">
        <strong>{solicitacoesFiltradas.length}</strong>{" "}
        {solicitacoesFiltradas.length === 1
          ? "solicitação encontrada"
          : "solicitações encontradas"}
      </p>

      <div className="solicitacoes__tabela-rolagem">
        <table className="solicitacoes__tabela">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Data</th>
              <th>Horário</th>
              <th>Destino</th>
              <th>Status</th>
              <th className="solicitacoes__coluna-acoes">Ações</th>
            </tr>
          </thead>

          <tbody>
            {solicitacoesFiltradas.map((solicitacao) => (
              <tr key={solicitacao.ticket}>
                <td className="solicitacoes__ticket">
                  #{solicitacao.ticket}
                </td>
                <td>{solicitacao.data}</td>
                <td>{solicitacao.horario}</td>
                <td>{solicitacao.destino}</td>
                <td>
                  <span
                    className={`solicitacoes__status solicitacoes__status--${solicitacao.status
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {solicitacao.status}
                  </span>
                </td>
                <td className="solicitacoes__coluna-acoes">
                  <button
                    className="solicitacoes__botao-detalhes"
                    type="button"
                    aria-label={`Ver detalhes de ${solicitacao.ticket}`}
                    onClick={() => onVerDetalhes(solicitacao)}
                  >
                    <span>Ver detalhes</span>
                    <Icone nome="seta" />
                  </button>
                </td>
              </tr>
            ))}

            {solicitacoesFiltradas.length === 0 && (
              <tr>
                <td className="solicitacoes__vazio" colSpan={6}>
                  Nenhuma solicitação encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
