import { useCallback, useState } from "react";
import { Link } from "../../app/routes/router";
import { ROTAS } from "../../app/routes/rotas";
import { useRemoteData } from "../../shared/api/useRemoteData";
import { buscarIndicadoresAbastecimentos, type IndicadoresAbastecimentosDto } from "../../shared/services/abastecimentos.service";
import { buscarVeiculos } from "../../shared/services/veiculos.service";
import "./Abastecimentos.css";
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

export function IndicadoresAbastecimentos() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const [veiculoId, setVeiculoId] = useState("");
  const veiculos = useRemoteData(buscarVeiculos, [] as Awaited<ReturnType<typeof buscarVeiculos>>);
  const carregar = useCallback((signal: AbortSignal) => buscarIndicadoresAbastecimentos({ inicio, fim, veiculoId }, signal), [inicio, fim, veiculoId]);
  const remoto = useRemoteData<IndicadoresAbastecimentosDto | null>(carregar, null);
  const dados = !remoto.loading && !remoto.error ? remoto.data : null;
  const indicadores = [
    { titulo: "Total gasto", descricao: "Valor total dos abastecimentos", valor: dados ? moeda.format(Number(dados.totalCusto)) : "—" },
    { titulo: "Litros abastecidos", descricao: "Quantidade de combustível registrada", valor: dados ? `${numero.format(Number(dados.totalLitros))} L` : "—" },
    { titulo: "Abastecimentos", descricao: "Quantidade de registros", valor: dados ? numero.format(dados.quantidade) : "—" },
    { titulo: "Custo por litro", descricao: "Custo total dividido pelos litros registrados", valor: dados?.custoPorLitro != null ? `R$ ${numero.format(Number(dados.custoPorLitro))}/L` : "—" },
  ];

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
              value={veiculoId}
              disabled={veiculos.loading || !!veiculos.error}
              onChange={e => setVeiculoId(e.target.value)}
            >
              <option value="">Todos os veículos</option>
              {veiculos.data.map(veiculo => <option key={veiculo.id} value={veiculo.id}>{veiculo.placa}</option>)}
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

        {veiculos.error && <div role="alert"><p>{veiculos.error}</p><button type="button" onClick={veiculos.retry}>Recarregar veículos</button></div>}
      </div>

      {remoto.loading && <p role="status">Carregando indicadores...</p>}
      {remoto.error && <div className="abastecimentos__painel" role="alert"><h2>Indicadores indisponíveis</h2><p>{remoto.error}</p><button type="button" onClick={remoto.retry}>Tentar novamente</button></div>}
      {dados?.estado === 'SEM_ABASTECIMENTOS' && <p role="status">Nenhum abastecimento encontrado no período.</p>}

      <div className="abastecimentos__indicadores">
        {indicadores.map((indicador) => (
          <article className="abastecimentos__painel" key={indicador.titulo}>
            <h3>{indicador.titulo}</h3>

            <p className="abastecimentos__indicador-valor">{indicador.valor}</p>

            <p>{indicador.descricao}</p>

            <small>{dados ? "Dados consultados no servidor" : "Dados indisponíveis"}</small>
          </article>
        ))}
      </div>

      {dados && <div className="abastecimentos__painel">
        <h2>Período e quilometragem observados</h2>
        <p>{dados.periodoObservado.inicio && dados.periodoObservado.fim
          ? `${dados.periodoObservado.inicio.split('-').reverse().join('/')} a ${dados.periodoObservado.fim.split('-').reverse().join('/')}`
          : "Período sem registros"}</p>
        {dados.kmObservadosPorVeiculo.map(item => <p key={item.veiculoId}>
          Veículo {veiculos.data.find(veiculo => veiculo.id === item.veiculoId)?.placa ?? item.veiculoId}: {item.leiturasComKm} leituras com km e {item.leiturasSemKm} sem km.
          Menor leitura: {item.menorKm === null ? "Não informada" : numero.format(item.menorKm)}; maior leitura: {item.maiorKm === null ? "Não informada" : numero.format(item.maiorKm)}.
        </p>)}
        <p>As leituras são observações; não representam distância percorrida.</p>
      </div>}
      <div className="abastecimentos__painel">
        <h2>Consumo por distância indisponível</h2>
        <p>A regra de associação dos litros às leituras de quilometragem ainda depende de definição de negócio. Nenhum consumo ou gráfico é estimado.</p>
      </div>
    </section>
  );
}
