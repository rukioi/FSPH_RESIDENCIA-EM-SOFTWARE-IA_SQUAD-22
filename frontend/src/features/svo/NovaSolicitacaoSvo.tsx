import { useState } from "react";
import "./NovaSolicitacaoSvo.css";

export type NovaSolicitacaoDados = {
  nomeFalecido: string;
  localFalecimento: string;
  endereco: string;
  nomeSolicitante: string;
  telefoneSolicitante: string;
};

type NovaSolicitacaoSvoProps = {
  onConfirmar?: (
    dados: NovaSolicitacaoDados,
  ) => void | Promise<void>;
  onVoltar?: () => void;
};

/** Anuncia envio/erro e mantém o formulário até a confirmação da operação existente. */
export function NovaSolicitacaoSvo({
  onConfirmar,
  onVoltar,
}: NovaSolicitacaoSvoProps) {
  const [nomeFalecido, setNomeFalecido] = useState("");
  const [localFalecimento, setLocalFalecimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nomeSolicitante, setNomeSolicitante] = useState("");
  const [telefoneSolicitante, setTelefoneSolicitante] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErro("");
    setEnviando(true);

    try {
      await onConfirmar?.({
        nomeFalecido,
        localFalecimento,
        endereco,
        nomeSolicitante,
        telefoneSolicitante,
      });
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a solicitação.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="svo-formulario">
      <header className="svo-formulario__cabecalho">
        <div>
          <h1>Nova Solicitação</h1>
          <p>Registro de atendimento telefônico SVO</p>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nomeFalecido">
            Nome do falecido
          </label>

          <input
            id="nomeFalecido"
            type="text"
            value={nomeFalecido}
            onChange={(event) =>
              setNomeFalecido(event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor="localFalecimento">
            Local do falecimento
          </label>

          <input
            id="localFalecimento"
            type="text"
            value={localFalecimento}
            onChange={(event) =>
              setLocalFalecimento(event.target.value)
            }
            required
          />
        </div>

        <div>
          <label htmlFor="endereco">
            Endereço de remoção
          </label>

          <input
            id="endereco"
            type="text"
            value={endereco}
            onChange={(event) =>
              setEndereco(event.target.value)
            }
            required
          />
        </div>

        <div>
          <label htmlFor="nomeSolicitante">
            Nome do solicitante
          </label>

          <input
            id="nomeSolicitante"
            type="text"
            value={nomeSolicitante}
            onChange={(event) =>
              setNomeSolicitante(event.target.value)
            }
            required
          />
        </div>

        <div>
          <label htmlFor="telefoneSolicitante">
            Telefone do solicitante
          </label>

          <input
            id="telefoneSolicitante"
            type="tel"
            value={telefoneSolicitante}
            onChange={(event) =>
              setTelefoneSolicitante(event.target.value)
            }
          />
        </div>

        {enviando && <p role="status">Confirmando solicitação...</p>}
        {erro && (
          <p className="svo-formulario__erro" role="alert">
            {erro}
          </p>
        )}

        <div className="svo-formulario__acoes">
          <button
            type="button"
            className="svo-formulario__voltar"
            onClick={onVoltar}
            disabled={enviando}
          >
            ← Voltar
          </button>

          <button
            type="submit"
            className="svo-formulario__confirmar"
            disabled={enviando}
          >
            {enviando ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </section>
  );
}
