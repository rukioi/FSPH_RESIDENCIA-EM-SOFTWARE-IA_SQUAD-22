import { useMemo, useState } from "react";
import { Link } from "../../app/routes/router";
import { ROTAS, rotaDetalheAbastecimento } from "../../app/routes/rotas";
import { useRemoteData } from "../../shared/api/useRemoteData";
import {
  buscarAbastecimentos,
  type AbastecimentoDto,
} from "../../shared/services/abastecimentos.service";
import "./Abastecimentos.css";

type Props = {
  veiculoId: string;
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function HistoricoAbastecimentos({ veiculoId }: Props) {
  const remoto = useRemoteData(buscarAbastecimentos, [] as AbastecimentoDto[]);

  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const registros = useMemo(() => {
    return remoto.data
      .filter((item) => String(item.veiculo_id) === veiculoId)
      .filter((item) => {
        const data = item.data_abastecimento.slice(0, 10);

        return (!inicio || data >= inicio) && (!fim || data <= fim);
      })
      .sort((a, b) => b.data_abastecimento.localeCompare(a.data_abastecimento));
  }, [remoto.data, veiculoId, inicio, fim]);

  return (
    <section className="abastecimentos">
      <header className="abastecimentos__cabecalho">
        <div>
          <h1>Histórico de abastecimentos</h1>
          <p>Consulte os registros de abastecimento do veículo.</p>
        </div>

        <Link para={ROTAS.abastecimentosGestor}>
          Voltar para abastecimentos
        </Link>
      </header>

      <div className="abastecimentos__painel">
        <h2>Filtrar histórico</h2>

        <div className="abastecimentos__filtros">
          <label>
            Período inicial
            <input
              type="date"
              value={inicio}
              max={fim || undefined}
              onChange={(e) => setInicio(e.target.value)}
            />
          </label>

          <label>
            Período final
            <input
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => setFim(e.target.value)}
            />
          </label>
        </div>
      </div>

      {remoto.loading ? (
        <p role="status">Carregando histórico...</p>
      ) : remoto.error ? (
        <div className="abastecimentos__aviso" role="alert">
          <p>{remoto.error}</p>
          <button type="button" onClick={remoto.retry}>
            Tentar novamente
          </button>
        </div>
      ) : registros.length === 0 ? (
        <div className="abastecimentos__painel">
          <p>Nenhum abastecimento encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="abastecimentos__tabela">
          <table>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Quilometragem</th>
                <th scope="col">Litros</th>
                <th scope="col">Valor</th>
                <th scope="col">Comprovante</th>
              </tr>
            </thead>

            <tbody>
              {registros.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.data_abastecimento
                      .slice(0, 10)
                      .split("-")
                      .reverse()
                      .join("/")}
                  </td>

                  <td>
                    {item.quilometragem == null
                      ? "Não informada"
                      : `${numero.format(item.quilometragem)} km`}
                  </td>

                  <td>{numero.format(Number(item.litragem))} L</td>

                  <td>{moeda.format(Number(item.valor_total))}</td>

                  <td>
                    <Link
                      para={rotaDetalheAbastecimento(String(item.id))}
                      className="abastecimentos__download"
                    >
                      {item.comprovante_nome
                        ? "Ver comprovante"
                        : "Ver detalhes"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
