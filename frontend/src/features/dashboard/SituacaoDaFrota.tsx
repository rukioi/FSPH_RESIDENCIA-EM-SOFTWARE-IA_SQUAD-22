import { useEffect, useState } from "react";
import "../../app/SituacaoDaFrota.css";

type StatusVeiculo = "disponivel" | "em_viagem" | "manutencao" | "indisponivel";

type Veiculo = {
  id: string;
  placa: string;
  status: StatusVeiculo;
};

const rotulos: Record<StatusVeiculo, string> = {
  disponivel: "Disponíveis",
  em_viagem: "Em viagem",
  manutencao: "Em manutenção",
  indisponivel: "Indisponíveis",
};

const ordem: StatusVeiculo[] = ["disponivel", "em_viagem", "manutencao", "indisponivel"];

const veiculosDeExemplo: Veiculo[] = [
  { id: "vf-01", placa: "VF-01", status: "disponivel" },
  { id: "vf-02", placa: "VF-02", status: "disponivel" },
  { id: "vf-03", placa: "VF-03", status: "disponivel" },
  { id: "vf-05", placa: "VF-05", status: "em_viagem" },
  { id: "vf-06", placa: "VF-06", status: "em_viagem" },
  { id: "vf-04", placa: "VF-04", status: "manutencao" },
  { id: "vf-07", placa: "VF-07", status: "manutencao" },
  { id: "vf-08", placa: "VF-08", status: "indisponivel" },
  { id: "vf-09", placa: "VF-09", status: "indisponivel" },
];

type SituacaoDaFrotaProps = {
  titulo?: string;
  veiculos?: Veiculo[];
  aoVerVeiculos?: () => void;
  classe?: string;
};

export function SituacaoDaFrota({
  titulo = "Situação da frota",
  veiculos = veiculosDeExemplo,
  aoVerVeiculos,
  classe = "",
}: SituacaoDaFrotaProps) {
  const [statusSelecionado, setStatusSelecionado] = useState<StatusVeiculo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (!modalAberto) return;

    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setModalAberto(false);
    };

    window.addEventListener("keydown", aoPressionarTecla);
    return () => window.removeEventListener("keydown", aoPressionarTecla);
  }, [modalAberto]);

  const total = veiculos.length;

  const resumo = ordem.map((status) => ({
    status,
    rotulo: rotulos[status],
    quantidade: veiculos.filter((veiculo) => veiculo.status === status).length,
  }));

  const veiculosNaTela = statusSelecionado
    ? veiculos.filter((veiculo) => veiculo.status === statusSelecionado)
    : veiculos;

  const aoClicarVerVeiculos = () => {
    if (aoVerVeiculos) {
      aoVerVeiculos();
      return;
    }

    setModalAberto(true);
  };

  const aoClicarNoStatus = (status: StatusVeiculo) => {
    setStatusSelecionado((atual) => (atual === status ? null : status));
  };

  return (
    <section className={`caixa-situacaodafrota ${classe}`} aria-label={titulo}>
      <header className="situacaodafrota-cabecalho">
        <h2 className="situacaodafrota-titulo">{titulo}</h2>
        <button
          type="button"
          className="situacaodafrota-botao"
          onClick={aoClicarVerVeiculos}
          aria-haspopup={aoVerVeiculos ? undefined : "dialog"}
          aria-expanded={aoVerVeiculos ? undefined : modalAberto}
        >
          Ver veículos
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

      {total === 0 ? (
        <p className="situacaodafrota-vazio">Nenhum veículo cadastrado.</p>
      ) : (
        <ul className="situacaodafrota-lista">
          {resumo.map((linha) => (
            <li key={linha.status}>
              <button
                type="button"
                className="situacaodafrota-item"
                data-status={linha.status}
                aria-pressed={statusSelecionado === linha.status}
                onClick={() => aoClicarNoStatus(linha.status)}
              >
                <span className="situacaodafrota-linha">
                  <span className="situacaodafrota-rotulo">{linha.rotulo}</span>
                  <span className="situacaodafrota-quantidade">{linha.quantidade}</span>
                </span>
                <span className="situacaodafrota-trilho" aria-hidden="true">
                  <span
                    className="situacaodafrota-preenchimento"
                    style={{ width: `${Math.round((linha.quantidade / total) * 100)}%` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="situacaodafrota-rodape">
        <span className="situacaodafrota-rotulo-rodape">
          {statusSelecionado ? rotulos[statusSelecionado] : "Total"}
          {statusSelecionado && (
            <button
              type="button"
              className="situacaodafrota-limpar"
              onClick={() => setStatusSelecionado(null)}
            >
              limpar
            </button>
          )}
        </span>
        <span className="situacaodafrota-total">
          {statusSelecionado ? veiculosNaTela.length : total} veículo{total === 1 ? "" : "s"}
        </span>
      </footer>

      {!aoVerVeiculos && modalAberto && (
        <div
          className="situacaodafrota-veu"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setModalAberto(false);
          }}
        >
          <div
            className="situacaodafrota-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${titulo} — veículos`}
          >
            <header className="situacaodafrota-cabecalho">
              <h3 className="situacaodafrota-titulo">
                {statusSelecionado ? rotulos[statusSelecionado] : titulo}
              </h3>
              <button
                type="button"
                className="situacaodafrota-botao situacaodafrota-fechar"
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

            <ul className="situacaodafrota-veiculos">
              {veiculosNaTela.length === 0 ? (
                <li className="situacaodafrota-vazio">Nenhum veículo nessa situação.</li>
              ) : (
                veiculosNaTela.map((veiculo) => (
                  <li className="situacaodafrota-veiculo" key={veiculo.id} data-status={veiculo.status}>
                    <span className="situacaodafrota-placa">{veiculo.placa}</span>
                    <span className="situacaodafrota-situacao">{rotulos[veiculo.status]}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}