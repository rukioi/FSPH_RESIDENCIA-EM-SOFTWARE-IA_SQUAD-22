import { useState } from "react";
import type {
  MotoristaApi,
  VeiculoApi,
} from "../../shared/types/svo";
import "./PrepararDespachoModal.css";

type PrepararDespachoModalProps = {
  ordemId: string;
  motoristas: MotoristaApi[];
  veiculos: VeiculoApi[];
  onFechar: () => void;
  onConfirmar: (
    motoristaId: number,
    veiculoId: number,
  ) => void | Promise<void>;
};

/** Aguarda o despacho e mantém a seleção aberta quando a API informa conflito ou falha. */
export function PrepararDespachoModal({
  ordemId,
  motoristas,
  veiculos,
  onFechar,
  onConfirmar,
}: PrepararDespachoModalProps) {
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleConfirmar() {
    if (!motoristaId || !veiculoId) {
      return;
    }

    setErro("");
    setEnviando(true);

    try {
      await onConfirmar(
        Number(motoristaId),
        Number(veiculoId),
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar o despacho.",
      );
    } finally {
      setEnviando(false);
    }
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
            <h2 id="svo-modal-titulo">
              Preparar despacho
            </h2>
            <p>Ordem de coleta #{ordemId}</p>
          </div>

          <button
            type="button"
            className="svo-modal__fechar"
            onClick={onFechar}
            disabled={enviando}
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
              value={veiculoId}
              onChange={(event) =>
                setVeiculoId(event.target.value)
              }
              disabled={enviando}
            >
              <option value="">
                Selecione um veículo
              </option>

              {veiculos.map((veiculo) => (
                <option
                  key={veiculo.id}
                  value={veiculo.id}
                >
                  {veiculo.modelo} - {veiculo.placa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="motorista">Motorista</label>

            <select
              id="motorista"
              value={motoristaId}
              onChange={(event) =>
                setMotoristaId(event.target.value)
              }
              disabled={enviando}
            >
              <option value="">
                Selecione um motorista
              </option>

              {motoristas.map((motorista) => (
                <option
                  key={motorista.id}
                  value={motorista.id}
                >
                  {motorista.nome}
                </option>
              ))}
            </select>
          </div>

          {erro && (
            <p className="svo-modal__erro" role="alert">{erro}</p>
          )}
        </div>

        {enviando && <p role="status">Confirmando despacho...</p>}
        <footer className="svo-modal__acoes">
          <button
            type="button"
            className="svo-modal__cancelar"
            onClick={onFechar}
            disabled={enviando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="svo-modal__confirmar"
            onClick={handleConfirmar}
            disabled={
              enviando || !veiculoId || !motoristaId
            }
          >
            {enviando
              ? "Confirmando..."
              : "Confirmar despacho"}
          </button>
        </footer>
      </div>
    </div>
  );
}
