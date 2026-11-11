import { useState } from "react";
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
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const periodoInvalido = Boolean(inicio && fim && inicio > fim);

  function limparPeriodo() {
    setInicio("");
    setFim("");
  }

  return (
    <section className="abastecimentos">
      <header className="abastecimentos__cabecalho">
        <div>
          <h1>Indicadores de abastecimento</h1>
          <p>Acompanhe os gastos e o consumo de combustível da frota.</p>
        </div>

        <Link para={ROTAS.abastecimentosGestor}>
          Voltar para abastecimentos
        </Link>
      </header>

      <div className="abastecimentos__painel">
        <h2>Filtros dos indicadores</h2>

        <div className="abastecimentos__indicadores-filtros">
          <div className="abastecimentos__indicadores-campo">
            <label htmlFor="indicadores-veiculo">Veículo</label>

            <select
              id="indicadores-veiculo"
              disabled
              aria-describedby="indicadores-aviso"
              defaultValue=""
            >
              <option value="">Aguardando integração com a API</option>
            </select>
          </div>

          <div className="abastecimentos__indicadores-campo">
            <label htmlFor="indicadores-inicio">Período inicial</label>

            <input
              id="indicadores-inicio"
              type="date"
              value={inicio}
              max={fim || undefined}
              aria-invalid={periodoInvalido}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>

          <div className="abastecimentos__indicadores-campo">
            <label htmlFor="indicadores-fim">Período final</label>

            <input
              id="indicadores-fim"
              type="date"
              value={fim}
              min={inicio || undefined}
              aria-invalid={periodoInvalido}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>

        <div className="abastecimentos__indicadores-acoes">
          <button
            type="button"
            onClick={limparPeriodo}
            disabled={!inicio && !fim}
          >
            Limpar período
          </button>
        </div>

        {periodoInvalido && (
          <p role="alert" className="abastecimentos__aviso">
            A data inicial não pode ser posterior à data final.
          </p>
        )}

        <p id="indicadores-aviso" role="status">
          Os filtros de período estão preparados, mas ainda não são aplicados
          aos dados. A consulta depende da API de indicadores da Sprint 9.
        </p>
      </div>

      <div className="abastecimentos__painel" role="status">
        <h2>Indicadores temporariamente indisponíveis</h2>

        <p>
          Aguardando a integração com a API de indicadores. Nenhuma métrica
          fictícia será apresentada.
        </p>
      </div>

      <div className="abastecimentos__indicadores">
        {indicadores.map((indicador) => (
          <article className="abastecimentos__painel" key={indicador.titulo}>
            <h3>{indicador.titulo}</h3>

            <p className="abastecimentos__indicador-valor">—</p>

            <p>{indicador.descricao}</p>

            <small>Dados ainda indisponíveis</small>
          </article>
        ))}
      </div>

      <div className="abastecimentos__painel">
        <h2>Evolução do consumo</h2>

        <p>
          O gráfico e sua tabela acessível serão exibidos quando os indicadores
          calculados pelo Back-end estiverem disponíveis.
        </p>

        <p>
          Não é possível calcular o consumo sem leituras válidas fornecidas pelo
          servidor.
        </p>
      </div>
    </section>
  );
}
