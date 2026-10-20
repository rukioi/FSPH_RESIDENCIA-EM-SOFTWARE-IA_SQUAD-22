import { useEffect, useState } from "react";
import "../../app/AtividadesRecentes.css";

export type EventoAtividadesRecentes = {
  id: string;
  hora: string;
  descricao: string;
};

const eventosDeExemplo: EventoAtividadesRecentes[] = [
  { id: "aprovacao-1022", hora: "09:42", descricao: "#TRP-1022 aprovado" },
  { id: "motorista-1021", hora: "09:20", descricao: "Motorista atribuído ao #TRP-1021" },
  { id: "concluida-1018", hora: "09:05", descricao: "Viagem #TRP-1018 concluída" },
  { id: "manutencao-vf04", hora: "08:45", descricao: "VF-04 colocado em manutenção" },
];

export type AtividadesRecentesProps = {
  titulo?: string;
  eventos?: EventoAtividadesRecentes[];
  aoVerTodas?: () => void;
  classe?: string;
};

function ListaEventos({ eventos }: { eventos: EventoAtividadesRecentes[] }) {
  if (eventos.length === 0) {
    return <p className="atividadesrecentes-vazio">Nenhuma atividade registrada.</p>;
  }

  return (
    <ol className="atividadesrecentes-lista" aria-label="Atividades recentes">
      {eventos.map((evento) => (
        <li className="atividadesrecentes-evento" key={evento.id}>
          <time className="atividadesrecentes-hora" dateTime={evento.hora}>
            {evento.hora}
          </time>
          <span className="atividadesrecentes-trilha" aria-hidden="true">
            <span className="atividadesrecentes-ponto" />
          </span>
          <p className="atividadesrecentes-descricao">{evento.descricao}</p>
        </li>
      ))}
    </ol>
  );
}

export function AtividadesRecentes({
  titulo = "Atividade recente",
  eventos = eventosDeExemplo,
  aoVerTodas,
  classe = "",
}: AtividadesRecentesProps) {
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (!modalAberto) return;

    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setModalAberto(false);
    };

    window.addEventListener("keydown", aoPressionarTecla);
    return () => window.removeEventListener("keydown", aoPressionarTecla);
  }, [modalAberto]);

  const aoClicarVerTodas = () => {
    if (aoVerTodas) {
      aoVerTodas();
      return;
    }
    setModalAberto(true);
  };

  const classeContainer = classe ? "caixa-atividadesrecentes " + classe : "caixa-atividadesrecentes";
  const labelModal = titulo + " - lista completa";

  return (
    <section className={classeContainer} aria-label={titulo}>
      <header className="atividadesrecentes-cabecalho">
        <h2 className="atividadesrecentes-titulo">{titulo}</h2>
        <button
          type="button"
          className="atividadesrecentes-botao"
          onClick={aoClicarVerTodas}
          aria-haspopup={aoVerTodas ? undefined : "dialog"}
          aria-expanded={aoVerTodas ? undefined : modalAberto}
        >
          Ver todas
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12h15M12 5l7 7-7 7" />
          </svg>
        </button>
      </header>

      <ListaEventos eventos={eventos} />

      {!aoVerTodas && modalAberto && (
        <div
          className="atividadesrecentes-veu"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setModalAberto(false);
          }}
        >
          <div
            className="atividadesrecentes-modal"
            role="dialog"
            aria-modal="true"
            aria-label={labelModal}
          >
            <header className="atividadesrecentes-cabecalho">
              <h3 className="atividadesrecentes-titulo">{titulo}</h3>
              <button
                type="button"
                className="atividadesrecentes-botao atividadesrecentes-fechar"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => setModalAberto(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <ListaEventos eventos={eventos} />
          </div>
        </div>
      )}
    </section>
  );
}