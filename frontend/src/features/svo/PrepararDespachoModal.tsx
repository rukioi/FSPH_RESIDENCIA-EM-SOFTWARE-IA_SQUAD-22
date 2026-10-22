import { useState } from "react";
import "./PrepararDespachoModal.css";

type PrepararDespachoModalProps = {
  ordemId: string;
  onFechar: () => void;
  onConfirmar: (veiculo: string, motorista: string) => void;
};

const veiculos = [
  "Veículo 01 - ABC1D23",
  "Veículo 02 - DEF4G56",
  "Veículo 03 - HIJ7K89",
];

const motoristas = [
  "Carlos Silva",
  "Marcos Santos",
  "João Oliveira",
];

export function PrepararDespachoModal({
  ordemId,
  onFechar,
  onConfirmar,
}: PrepararDespachoModalProps) {
  const [veiculo, setVeiculo] = useState("");
  const [motorista, setMotorista] = useState("");

  function handleConfirmar() {
    if (!veiculo || !motorista) {
      return;
    }

    onConfirmar(veiculo, motorista);
  }

  return (
    <div className="svo-modal__fundo">
      <div
        className="svo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="svo-modal-titulo"
      >
        <header className="svo-modal__cabecalho">
          <div>
            <h2 id="svo-modal-titulo">Preparar despacho</h2>
            <p>Ordem de coleta #{ordemId}</p>
          </div>

          <button
            type="button"
            className="svo-modal__fechar"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="svo-modal__conteudo">
          <div>
            <label htmlFor="veiculo">Veículo</label>

            <select
              id="veiculo"
              value={veiculo}
              onChange={(event) => setVeiculo(event.target.value)}
            >
              <option value="">Selecione um veículo</option>

              {veiculos.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="motorista">Motorista</label>

            <select
              id="motorista"
              value={motorista}
              onChange={(event) => setMotorista(event.target.value)}
            >
              <option value="">Selecione um motorista</option>

              {motoristas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer className="svo-modal__acoes">
          <button
            type="button"
            className="svo-modal__cancelar"
            onClick={onFechar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="svo-modal__confirmar"
            disabled={!veiculo || !motorista}
            onClick={handleConfirmar}
          >
            Confirmar despacho
          </button>
        </footer>
      </div>
    </div>
  );
}
