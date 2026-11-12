import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "../../app/routes/router";
import { ROTAS } from "../../app/routes/rotas";
import { useRemoteData } from "../../shared/api/useRemoteData";
import { errorMessage } from "../../shared/api/errors";
import {
  buscarDetalheAbastecimento,
  baixarComprovanteAbastecimento,
  type DetalheAbastecimentoDto,
} from "../../shared/services/abastecimentos.service";
import "./Abastecimentos.css";

type Props = {
  id: string;
};

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function DetalheAbastecimento({ id }: Props) {
  const carregar = useCallback((signal: AbortSignal) => buscarDetalheAbastecimento(id, signal), [id]);
  const remoto = useRemoteData<DetalheAbastecimentoDto | null>(carregar, null);

  const [baixando, setBaixando] = useState(false);
  const [erroDownload, setErroDownload] = useState("");

  const downloadController = useRef<AbortController | null>(null);

  const registro = remoto.data;

  // Cancela o download caso o usuário saia da página.
  useEffect(() => {
    return () => {
      downloadController.current?.abort();
    };
  }, []);

  async function baixarComprovante() {
    if (!registro?.comprovante_nome || downloadController.current) {
      return;
    }

    const controller = new AbortController();
    downloadController.current = controller;

    setBaixando(true);
    setErroDownload("");

    try {
      const blob = await baixarComprovanteAbastecimento(
        registro.id,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      // Cria um endereço temporário, sem expor uma URL pública.
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = registro.comprovante_nome;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Libera o endereço temporário após iniciar o download.
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (falha) {
      if (!controller.signal.aborted) {
        setErroDownload(errorMessage(falha));
      }
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
      }

      if (!controller.signal.aborted) {
        setBaixando(false);
      }
    }
  }

  return (
    <section className="abastecimentos">
      <header className="abastecimentos__cabecalho">
        <div>
          <h1>Detalhes do abastecimento</h1>
          <p>Consulte as informações registradas na frota.</p>
        </div>

        <Link para={ROTAS.abastecimentosGestor}>
          Voltar para abastecimentos
        </Link>
      </header>

      {remoto.loading ? (
        <p role="status">Carregando abastecimento...</p>
      ) : remoto.error ? (
        <div role="alert" className="abastecimentos__aviso">
          <p>{remoto.error}</p>

          <button type="button" onClick={remoto.retry}>
            Tentar novamente
          </button>
        </div>
      ) : !registro ? (
        <div role="status" className="abastecimentos__painel">
          <p>Abastecimento não encontrado nos registros disponíveis.</p>
        </div>
      ) : (
        <div className="abastecimentos__painel">
          <h2>Abastecimento #{registro.id}</h2>

          <dl className="abastecimentos__detalhes">
            <div>
              <dt>Veículo</dt>
              <dd>{registro.veiculo_placa ?? "Não informado"}</dd>
            </div>

            <div>
              <dt>Motorista</dt>
              <dd>{registro.motorista_nome ?? "Não informado"}</dd>
            </div>

            <div>
              <dt>Data</dt>
              <dd>
                {registro.data_abastecimento
                  .slice(0, 10)
                  .split("-")
                  .reverse()
                  .join("/")}
              </dd>
            </div>

            <div>
              <dt>Posto de combustível</dt>
              <dd>{registro.posto ?? "Não informado"}</dd>
            </div>

            <div>
              <dt>Quilometragem</dt>
              <dd>{registro.quilometragem === null ? "Não informada" : `${numero.format(registro.quilometragem)} km`}</dd>
            </div>

            <div>
              <dt>Litros abastecidos</dt>
              <dd>{numero.format(Number(registro.litragem))} L</dd>
            </div>

            <div>
              <dt>Valor total</dt>
              <dd>{moeda.format(Number(registro.valor_total))}</dd>
            </div>

            <div>
              <dt>Tanque completo</dt>
              <dd>{registro.tanque_completo ? "Sim" : "Não"}</dd>
            </div>

            <div>
              <dt>Comprovante</dt>

              <dd>
                {registro.comprovante_nome ? (
                  <button
                    type="button"
                    className="abastecimentos__download"
                    onClick={() => void baixarComprovante()}
                    disabled={baixando}
                    aria-label={`Baixar comprovante do abastecimento ${registro.id}`}
                  >
                    {baixando ? "Baixando..." : "Baixar comprovante"}
                  </button>
                ) : (
                  "Não anexado"
                )}
              </dd>
            </div>
          </dl>

          {erroDownload && (
            <p role="alert" className="abastecimentos__aviso">
              {erroDownload}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
