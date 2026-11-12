import { useCallback, useState } from "react";
import { Link } from "../../app/routes/router";
import { ROTAS, rotaDetalheAbastecimento } from "../../app/routes/rotas";
import { useRemoteData } from "../../shared/api/useRemoteData";
import {
  buscarHistoricoAbastecimentos,
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
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const carregar = useCallback((signal: AbortSignal) => buscarHistoricoAbastecimentos(
    veiculoId, { inicio, fim, pagina, limit: 20 }, signal), [veiculoId, inicio, fim, pagina]);
  const remoto = useRemoteData<Awaited<ReturnType<typeof buscarHistoricoAbastecimentos>> | null>(carregar, null);
  const registros = remoto.data?.data ?? [];

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
              onChange={(e) => { setInicio(e.target.value); setPagina(1); }}
            />
          </label>

          <label>
            Período final
            <input
              type="date"
              value={fim}
              min={inicio || undefined}
              onChange={(e) => { setFim(e.target.value); setPagina(1); }}
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
      {!remoto.loading && !remoto.error && remoto.data && (
        <nav className="abastecimentos__paginacao" aria-label="Paginação do histórico">
          <button type="button" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {Math.max(1, Math.ceil(remoto.data.meta.total / remoto.data.meta.limit))}</span>
          <button type="button" disabled={pagina * remoto.data.meta.limit >= remoto.data.meta.total}
            onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </nav>
      )}
    </section>
  );
}
