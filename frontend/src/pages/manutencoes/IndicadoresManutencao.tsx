import { useCallback, useId, useState } from 'react';
import { Link } from '../../app/routes/router';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { ApiError, errorMessage } from '../../shared/api/errors';
import { Icone } from '../../shared/components/Icone';
import { consultarIndicadoresManutencao, type Indicadores, type FiltrosIndicadores } from '../../shared/services/manutencoes.service';
import { dataPt, dinheiro, estados, instantePt } from './manutencoes.form';
import type { BuscaNavegacao } from './manutencoes.navegacao';

type Grupo = Indicadores['alertas']['atrasos'];
type Props = {
  filtros: FiltrosIndicadores; revisao: number; rota: (id: string) => string;
  estado: BuscaNavegacao | null; aoPerderAcesso: () => void;
};

function Ocorrencias({grupo, rota, estado}: {grupo: Grupo; rota: Props['rota']; estado: Props['estado']}) {
  return <>
    <ul className="manutencoes__alertas-lista">
      {grupo.itens.map(item => <li key={item.id}>
        <Link para={rota(item.id)} estado={estado} ariaLabel={'Ver manutenção do veículo ' + item.veiculo.placa + ' #' + item.id}>
          <strong>{item.veiculo.placa}</strong> · {estados[item.status]} · Entrada {dataPt(item.entrada)} · Previsão {dataPt(item.conclusaoPrevista)}
        </Link>
      </li>)}
    </ul>
    {grupo.total > grupo.itens.length && <p>Exibindo {grupo.itens.length} de {grupo.total} ocorrências.</p>}
  </>;
}

function periodoTexto({inicio,fim}: Indicadores['periodo']) {
  if (inicio && fim) return dataPt(inicio) + ' a ' + dataPt(fim);
  if (inicio) return 'Desde ' + dataPt(inicio);
  return fim ? 'Até ' + dataPt(fim) : 'Sem limite de datas';
}

export function IndicadoresManutencao({filtros, revisao, rota, estado, aoPerderAcesso}: Props) {
  const {veiculoId,tipo,inicio,fim} = filtros;
  const chave = JSON.stringify([veiculoId,tipo,inicio,fim,revisao]);
  const carregar = useCallback(async(signal: AbortSignal) => {
    try {
      const data = await consultarIndicadoresManutencao({veiculoId,tipo,inicio,fim}, signal);
      return {chave,data,erro:null};
    } catch (erro) {
      if (!signal.aborted && erro instanceof ApiError && erro.status === 403) aoPerderAcesso();
      return {chave,data:null,erro:errorMessage(erro)};
    }
  },[veiculoId,tipo,inicio,fim,chave,aoPerderAcesso]);
  const remoto = useRemoteData(carregar,null);
  const [expansao,setExpansao] = useState<string>();
  const painelId = useId();
  if (remoto.data?.chave === chave && remoto.data.erro && !remoto.loading) return <section className="manutencoes__estado" aria-label="Indicadores">
    <p role="alert">Indicadores indisponíveis. {remoto.data.erro}</p>
    <button className="btn btn--secundario" type="button" onClick={remoto.retry}>Tentar novamente os indicadores</button>
  </section>;
  if (remoto.loading || remoto.data?.chave !== chave || !remoto.data.data) {
    return <p className="manutencoes__estado" role="status">Carregando indicadores...</p>;
  }
  const {data} = remoto.data;
  const {estoqueAtual: estoque, periodo, referencia, alertas} = data;
  const {custo} = periodo;
  const valor = custo.totalConhecido === null && custo.comCustoInformado === 0 && custo.comCustoDesconhecido === 0
    ? 'Sem ocorrências no recorte'
    : dinheiro(custo.totalConhecido?.match(/^0+(?:\.0+)?$/) ? '0' : custo.totalConhecido);
  const aberto = expansao === chave;
  const cards = [
    {id:'veiculos', titulo:'Veículos em manutenção', valor:estoque.veiculosEmManutencao, escopo:'Estoque atual · veículos distintos', icone:'manutencao'},
    {id:'agendadas', titulo:'Agendadas', valor:estoque.agendadas, escopo:'Estoque atual', icone:'calendario'},
    {id:'andamento', titulo:'Em andamento', valor:estoque.emAndamento, escopo:'Estoque atual', icone:'solicitacoes'},
    {id:'concluidas', titulo:'Concluídas', valor:periodo.concluidas, escopo:'Por conclusão efetiva', icone:'check'},
    {id:'atrasadas', titulo:'Atrasadas', valor:estoque.atrasadas, escopo:'Estoque atual', icone:'notificacoes'},
    {id:'custo', titulo:'Custo no período', valor, escopo:'Por entrada planejada · não canceladas', icone:'relatorios'},
  ] as const;
  const formato = new Intl.NumberFormat('pt-BR');
  return <>
    <section className="manutencoes__indicadores" aria-label="Indicadores de manutenção">
      <p className="manutencoes__referencia" title={instantePt(referencia.instante) + ' · ' + referencia.fuso}>
        Referência {dataPt(referencia.dataCivil)} · {periodoTexto(periodo)}
      </p>
      <div className="manutencoes__indicadores-grade">
        {cards.map(card => {
          const conteudo = <>
            <span className="manutencoes__indicador-topo"><span>{card.titulo}</span><span className="manutencoes__indicador-icone"><Icone nome={card.icone}/></span></span>
            <strong>{typeof card.valor === 'number' ? formato.format(card.valor) : card.valor}</strong>
            <small>{card.escopo}</small>
            {card.id === 'custo' && (custo.comCustoInformado > 0 || custo.comCustoDesconhecido > 0) &&
              <small>{formato.format(custo.comCustoInformado)} com custo · {formato.format(custo.comCustoDesconhecido)} sem custo</small>}
          </>;
          const classe = 'manutencoes__indicador manutencoes__indicador--' + card.id;
          return card.id === 'atrasadas' && alertas.atrasos.total > 0
            ? <button key={card.id} type="button" className={classe} aria-label={'Atrasadas: ' + alertas.atrasos.total + ' ocorrências'}
                aria-expanded={aberto} aria-controls={painelId} onClick={() => setExpansao(aberto ? undefined : chave)}>{conteudo}</button>
            : <article key={card.id} className={classe} aria-label={card.titulo}>{conteudo}</article>;
        })}
      </div>
      {alertas.atrasos.total > 0 && <section id={painelId} hidden={!aberto} className="manutencoes__atrasos" aria-label="Ocorrências atrasadas">
        <h2>Ocorrências atrasadas</h2><Ocorrencias grupo={alertas.atrasos} rota={rota} estado={estado}/>
      </section>}
    </section>
    {alertas.preventivasProximos7Dias.total > 0 && <section className="manutencoes__preventivas" aria-label="Preventivas nos próximos 7 dias">
      <h2><Icone nome="calendario"/> Preventivas nos próximos 7 dias</h2>
      <Ocorrencias grupo={alertas.preventivasProximos7Dias} rota={rota} estado={estado}/>
    </section>}
  </>;
}
