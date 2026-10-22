import { useState } from "react";
import "./NovaSolicitacaoSvo.css";

export type NovaSolicitacaoDados = {
  nomeFalecido: string;
  endereco: string;
  nomeSolicitante: string;
  telefoneSolicitante: string;
};

type NovaSolicitacaoSvoProps = {
  onConfirmar?: (dados: NovaSolicitacaoDados) => void;
  onVoltar?: () => void;
};

export function NovaSolicitacaoSvo({
  onConfirmar,
  onVoltar,
}: NovaSolicitacaoSvoProps) {
  const [nomeFalecido, setNomeFalecido] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nomeSolicitante, setNomeSolicitante] = useState("");
  const [telefoneSolicitante, setTelefoneSolicitante] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onConfirmar?.({
      nomeFalecido,
      endereco,
      nomeSolicitante,
      telefoneSolicitante,
    });
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
          <label htmlFor="nomeFalecido">Nome do falecido</label>
          <input
            id="nomeFalecido"
            type="text"
            value={nomeFalecido}
            onChange={(event) => setNomeFalecido(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="endereco">Endereço da ocorrência</label>
          <input
            id="endereco"
            type="text"
            value={endereco}
            onChange={(event) => setEndereco(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="nomeSolicitante">Nome do solicitante</label>
          <input
            id="nomeSolicitante"
            type="text"
            value={nomeSolicitante}
            onChange={(event) => setNomeSolicitante(event.target.value)}
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
            required
          />
        </div>

        <div className="svo-formulario__acoes">
          <button
            type="button"
            className="svo-formulario__voltar"
            onClick={onVoltar}
          >
            ← Voltar
          </button>

          <button
            type="submit"
            className="svo-formulario__confirmar"
          >
            Confirmar
          </button>
        </div>
      </form>
    </section>
  );
}
