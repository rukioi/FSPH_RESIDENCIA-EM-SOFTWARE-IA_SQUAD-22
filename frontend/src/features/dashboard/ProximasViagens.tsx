import { useEffect, useState } from "react";
import "../../app/ProximasViagens.css";

export type SituacaoViagem = "agendada" | "aguardando_inicio";

export type Viagem = {
  id: string;
  hora: string;
  codigo: string;
  origem: string;
  destino: string;
  situacao: SituacaoViagem;
};

export type ProximasViagensProps = {
  titulo?: string;
  viagens?: Viagem[];
  aoVerTodasSolicitacoes?: () => void;
  classe?: string;
};

const viagensDeExemplo: Viagem[] = [
  {
    id: "1",
    hora: "16:20",
    codigo: "#TRP-1021",
    origem: "Hemose",
    destino: "Unidade Messejana",
    situacao: "agendada",
  },
  {
    id: "2",
    hora: "17:00",
    codigo: "#TRP-1020",
    origem: "Laboratório Central",
    destino: "Hospital Regional",
    situacao: "aguardando_inicio",
  },
];

const rotulosStatus: Record<SituacaoViagem, string> = {
  agendada: "Agendada",
  aguardando_inicio: "Aguardando início",
};

function IconeSeta() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ListaDeViagens({ viagens }: { viagens: Viagem[] }) {
  if (viagens.length === 0) {
    return <p className="proximasviagens-vazio">{"Nenhuma próxima viagem agendada."}</p>;
  }

  return (
    <ul className="proximasviagens-lista">
      {viagens.map((viagem) => (
        <li key={viagem.id} className="proximasviagens-item">
          <time className="proximasviagens-hora">{viagem.hora}</time>
          <div className="proximasviagens-detalhes">
            <span className="proximasviagens-codigo">{viagem.codigo}</span>
            {/* A linha abaixo foi corrigida para usar Template Literals, blindando contra caracteres invisíveis */}
            <p className="proximasviagens-itinerario">
              {`${viagem.origem} →${viagem.destino}`}
            </p>
            <span className={`proximasviagens-selo proximasviagens-selo-${viagem.situacao}`}>
              {rotulosStatus[viagem.situacao]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProximasViagens({
  titulo = "Próximas viagens",
  viagens = viagensDeExemplo,
  aoVerTodasSolicitacoes,
  classe = "",
}: ProximasViagensProps) {
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (!modalAberto) return;
    function aoApertarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setModalAberto(false);
    }
    window.addEventListener("keydown", aoApertarTecla);
    return () => window.removeEventListener("keydown", aoApertarTecla);
  }, [modalAberto]);

  function aoClicarAcao() {
    if (aoVerTodasSolicitacoes) {
      aoVerTodasSolicitacoes();
      return;
    }
    setModalAberto(true);
  }

  return (
    <section className={`caixa-proximasviagens ${classe}`.trim()}>
      <header className="proximasviagens-cabecalho">
        <h2 className="proximasviagens-titulo">{titulo}</h2>
        <button
          type="button"
          className="proximasviagens-botao-acao"
          onClick={aoClicarAcao}
        >
          {"Ver todas as solicitações"}
          <IconeSeta />
        </button>
      </header>

      <ListaDeViagens viagens={viagens} />

      {modalAberto && (
        <div
          className="proximasviagens-veu"
          onClick={() => setModalAberto(false)}
          role="presentation"
        >
          <div
            className="proximasviagens-modal"
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            onClick={(evento) => evento.stopPropagation()}
          >
            <header className="proximasviagens-modal-cabecalho">
              <h2 className="proximasviagens-titulo">{titulo}</h2>
              <button
                type="button"
                className="proximasviagens-fechar"
                aria-label="Fechar"
                onClick={() => setModalAberto(false)}
              >
                <IconeFechar />
              </button>
            </header>
            <ListaDeViagens viagens={viagens} />
          </div>
        </div>
      )}
    </section>
  );
}
