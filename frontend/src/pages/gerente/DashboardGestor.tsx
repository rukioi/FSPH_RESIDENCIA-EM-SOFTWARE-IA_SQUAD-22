import { useCallback, useEffect, useRef, useState } from 'react';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { buscarDashboard, buscarPendenciasDashboard } from '../../shared/services/dashboard.service';
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas';
import '../../features/dashboard/KpiCards.css';
import '../../app/Widgets.css';
import './DashboardGestor.css';
import { DistribuicaoGestor } from '../../features/dashboard/DistribuicaoGestor';
import { notifyDataChanged, onDataChanged } from '../../shared/api/dataChanges';

type Periodo = 'hoje' | '7d' | '30d' | 'personalizado';
const periodos: Array<[Periodo, string]> = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['personalizado', 'Personalizado']];
const dataCivil = (valor: string | null) => valor ? valor.slice(0, 10).split('-').reverse().join('/') + (valor.length > 10 ? ` ${valor.slice(11, 16)}` : '') : 'Data não informada';
const nomeStatus = (status: string | null) => status ? status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR') : 'Não informado';

/** Apresenta o resumo institucional sem substituir dados ausentes por valores fictícios. */
export function Dashboard() {
  const [periodo, setPeriodo] = useState<Periodo>('hoje');
  const [personalizadoAberto, setPersonalizadoAberto] = useState(false);
  const [erroPeriodo, setErroPeriodo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [intervalo, setIntervalo] = useState({ inicio: '', fim: '' });
  const load = useCallback((signal: AbortSignal) => buscarDashboard(periodo, intervalo.inicio, intervalo.fim, signal), [periodo, intervalo]);
  const resumo = useRemoteData(load, null);
  const pendencias = useRemoteData(buscarPendenciasDashboard, null);
  const dados = resumo.data;
  const ultimaAtualizacao = useRef(0);
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== 'visible' || resumo.loading || pendencias.loading || Date.now() - ultimaAtualizacao.current < 1000) return;
      ultimaAtualizacao.current = Date.now();
      notifyDataChanged();
    };
    const unsubscribe = onDataChanged(() => { resumo.retry(); pendencias.retry(); });
    const timer = window.setInterval(atualizar, 30_000);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => { window.clearInterval(timer); unsubscribe(); window.removeEventListener('focus', atualizar); document.removeEventListener('visibilitychange', atualizar); };
  });
  const aplicar = () => {
    const dias = (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000;
    if (dias > 0 && dias <= 31) { setErroPeriodo(''); setIntervalo({ inicio, fim }); setPeriodo('personalizado'); } else setErroPeriodo('Informe um intervalo válido de até 31 dias.');
  };
  return <div className="gestor-dashboard">
    <div className="cabecalho-pagina"><div><h1>Dashboard</h1><p>Visão geral da operação da frota</p></div>
      <div className="periodo" role="group" aria-label="Período">{periodos.map(([valor, nome]) => <button key={valor} type="button" aria-pressed={periodo === valor} className={`periodo__botao ${periodo === valor ? 'periodo__botao--ativo' : ''}`} onClick={() => valor === 'personalizado' ? setPersonalizadoAberto(true) : (setPersonalizadoAberto(false), setPeriodo(valor))}>{nome}</button>)}</div>
    </div>
    {personalizadoAberto && <div className="dashboard-filtros"><label>Início<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label><label>Fim exclusivo<input type="date" value={fim} onChange={e => setFim(e.target.value)} /></label><button type="button" onClick={aplicar}>Aplicar período</button><small>Até 31 dias; a data final não está incluída.</small>{erroPeriodo && <span role="alert">{erroPeriodo}</span>}</div>}

    {resumo.loading && !dados && <p className="gestor-carregando" role="status">Carregando indicadores…</p>}
    {resumo.error && <div className="gestor-aviso" role="status"><span>{dados ? 'Não foi possível atualizar o painel. Os dados anteriores foram mantidos.' : 'Não foi possível carregar o painel agora.'}</span><button type="button" onClick={resumo.retry}>Recarregar</button></div>}
    {dados && <div className={resumo.loading ? "gestor-resultados gestor-resultados--carregando" : "gestor-resultados"} aria-busy={resumo.loading}>
      <section className="cards-kpis" aria-label="Indicadores"><article className="card-kpi"><span>Chamados pendentes</span><strong>{dados.indicadores.pendentes}</strong><small>Fila atual de análise</small><a href="#gestor-fila">Analisar chamados →</a></article><article className="card-kpi"><span>{periodo === 'hoje' ? 'Viagens programadas hoje' : 'Viagens programadas'}</span><strong>{dados.solicitacoesPorStatus.filter(item => item.status === 'AGENDADA' || item.status === 'PRONTA_PARA_INICIAR').reduce((total, item) => total + item.total, 0)}</strong><small>Agendadas ou prontas para iniciar no período</small><a href="#gestor-viagens">Ver programação →</a></article><article className="card-kpi"><span>Veículos disponíveis</span><strong>{dados.indicadores.veiculosDisponiveis}</strong><small>Livres no período · frota administrativa</small><a href={ROTAS.veiculosGestor}>Consultar frota →</a></article><article className="card-kpi"><span>Motoristas disponíveis</span><strong>{dados.motoristasDisponiveis ?? '—'}</strong><small>{dados.motoristasDisponiveisMotivo ?? 'Nenhum motorista cadastrado'}</small><a href={ROTAS.motoristasGestor}>Consultar motoristas →</a></article></section>
      <div className="dashboard-modulos">
        <section className="painel-operacional gestor-painel"><h2>Visão geral dos chamados</h2><p>Acompanhe as solicitações previstas para o período.</p><DistribuicaoGestor itens={dados.solicitacoesPorStatus} /><a href={ROTAS.solicitacoesGestor}>Ver solicitações →</a></section>
        <section className="painel-operacional gestor-painel"><h2>Atividade recente</h2><p>Últimas movimentações das solicitações do período.</p><ul className="dashboard-lista">{dados.indicadores.atividadeRecente.length ? dados.indicadores.atividadeRecente.map(item => <li key={item.id}><span>{dataCivil(item.dataHora)} · {item.descricao}</span><a href={rotaSolicitacao(ROTAS.solicitacoesGestor, String(item.solicitacaoId))}>Ver</a></li>) : <li>Nenhuma atividade recente neste período.</li>}</ul></section>
        <section className="painel-operacional gestor-painel"><h2>Situação da frota</h2><p>Acompanhe a situação atual dos veículos.</p><DistribuicaoGestor itens={dados.veiculosPorStatus} frota /><a href={ROTAS.veiculosGestor}>Ver veículos →</a></section>
        <section className="painel-operacional gestor-painel"><h2 id="gestor-viagens">Próximas viagens</h2><p>Agendadas ou prontas no período selecionado.</p><ul className="dashboard-lista">{dados.proximasViagens.length ? dados.proximasViagens.map(item => <li key={item.id}><span>{dataCivil(item.data_hora_saida)} · {item.codigo}<br />{item.origem} → {item.destino}<br />{nomeStatus(item.status)}</span><a href={rotaSolicitacao(ROTAS.solicitacoesGestor, String(item.id))}>Ver</a></li>) : <li>Nenhuma viagem programada para este período.</li>}</ul></section>
        <section className="painel-operacional gestor-painel"><h2>Pendências documentais</h2><p>Documentos vencidos ou com vencimento nos próximos 30 dias.</p>{pendencias.loading && !pendencias.data ? <p role="status">Carregando pendências…</p> : <>{pendencias.error && <div className="gestor-aviso" role="status"><span>Não foi possível atualizar as pendências.</span><button type="button" onClick={pendencias.retry}>Recarregar</button></div>}{pendencias.data && <ul className="dashboard-lista">{pendencias.data.motoristas.length + pendencias.data.documentos.length === 0 && <li>Nenhuma pendência encontrada.</li>}{pendencias.data.motoristas.map(item => <li key={`m${item.id}`}><span>CNH · {item.nome}<br />{item.situacao === 'VENCIDO' ? 'Vencida' : 'Próxima do vencimento'} · {dataCivil(item.vencimento)}</span><a href={ROTAS.motoristasGestor}>Motoristas</a></li>)}{pendencias.data.documentos.map(item => <li key={`d${item.id}`}><span>{item.tipo_documento} · {item.placa}<br />{item.situacao === 'VENCIDO' ? 'Vencido' : 'Próximo do vencimento'} · {dataCivil(item.vencimento)}</span><a href={ROTAS.veiculosGestor}>Veículos</a></li>)}</ul>}</>}</section>
        <section className="painel-operacional gestor-painel"><h2 id="gestor-fila">Aguardando análise</h2><p>Priorize as solicitações que precisam de uma decisão.</p><ul className="dashboard-lista">{dados.indicadores.filaAguardandoAnalise.length ? dados.indicadores.filaAguardandoAnalise.map(item => <li key={item.id}><span>{item.codigoExibicao}<br />{item.origem} → {item.destino}<br />Criado em {dataCivil(item.criadoEm)}</span><a href={rotaSolicitacao(ROTAS.solicitacoesGestor, String(item.id))}>Analisar</a></li>) : <li>Nenhum chamado aguardando análise.</li>}</ul><a href={ROTAS.solicitacoesGestor}>Ver solicitações →</a></section>
      </div>
    </div>}
  </div>;
}
