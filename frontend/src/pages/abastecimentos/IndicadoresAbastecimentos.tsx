import { Link } from "../../app/routes/router";
import { ROTAS } from "../../app/routes/rotas";
import "./Abastecimentos.css";

const indicadores = [
  {
    titulo: "Total gasto",
    descricao: "Valor total dos abastecimentos",
  },
  {
    titulo: "Litros abastecidos",
    descricao: "Quantidade de combustível registrada",
  },
  {
    titulo: "Distância percorrida",
    descricao: "Distância calculada com leituras válidas",
  },
  {
    titulo: "Consumo médio",
    descricao: "Consumo calculado pelo servidor",
  },
];

export function IndicadoresAbastecimentos() {
  return (
    <section className="abastecimentos">
      <header className="abastecimentos__cabecalho">
        <div>
          <h1>Indicadores de abastecimento</h1>
          <p>
            Acompanhe os gastos e o consumo de combustível
            da frota.
          </p>
        </div>

        <Link para={ROTAS.abastecimentosGestor}>
          Voltar para abastecimentos
        </Link>
      </header>

      <div
        className="abastecimentos__painel"
        role="status"
      >
        <h2>Indicadores temporariamente indisponíveis</h2>
        <p>
          Aguardando a integração com a API de indicadores
          da Sprint 9. Nenhuma informação fictícia será
          apresentada.
        </p>
      </div>

      <div className="abastecimentos__indicadores">
        {indicadores.map((indicador) => (
          <article
            className="abastecimentos__painel"
            key={indicador.titulo}
          >
            <h3>{indicador.titulo}</h3>

            <p className="abastecimentos__indicador-valor">
              —
            </p>

            <p>{indicador.descricao}</p>

            <small>
              Aguardando dados da API
            </small>
          </article>
        ))}
      </div>

      <div className="abastecimentos__painel">
        <h2>Evolução do consumo</h2>
        <p>
          O gráfico e sua tabela de dados serão exibidos
          quando os indicadores calculados pelo Back-end
          estiverem disponíveis.
        </p>
      </div>
    </section>
  );
}
