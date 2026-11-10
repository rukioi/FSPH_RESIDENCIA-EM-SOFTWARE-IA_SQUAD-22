import { Link } from "../../app/routes/router";
import { ROTAS } from "../../app/routes/rotas";
import { useRemoteData } from "../../shared/api/useRemoteData";
import {
  buscarAbastecimentos,
  type AbastecimentoDto,
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
  const remoto = useRemoteData(buscarAbastecimentos, [] as AbastecimentoDto[]);

  const registro = remoto.data.find((item) => item.id === id);

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
              <dd>{numero.format(registro.quilometragem)} km</dd>
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
                {registro.comprovante_nome
                  ? "Comprovante anexado"
                  : "Não anexado"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
