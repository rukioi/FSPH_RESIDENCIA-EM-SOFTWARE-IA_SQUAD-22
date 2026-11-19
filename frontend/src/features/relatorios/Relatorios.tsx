import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarRecursosRelatorios, buscarRelatorio, statusPorRelatorio, type ConsultaRelatorio } from '../../shared/services/relatorios.service';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { errorMessage } from '../../shared/api/errors';
import { Select } from '../../shared/components/Select';
import { DatePicker } from '../../shared/components/DatePicker';
import { exportarRelatorio, formatarCelula } from './exportar';
import './Relatorios.css';

const nomes: Record<ConsultaRelatorio['tipo'],string> = {viagens:'Viagens',solicitacoes:'Solicitações',veiculos:'Demandas por veículo',motoristas:'Viagens por motorista',ocorrencias:'Ocorrências e justificativas',abastecimentos:'Abastecimentos',svo:'Ordens de coleta SVO'};
const statusTexto: Record<string,string> = {AGENDADA:'Agendada',EM_TRANSPORTE:'Em transporte',CONCLUIDA:'Concluída',CANCELADA:'Cancelada',PENDENTE:'Pendente',APROVADA:'Aprovada',PRONTA_PARA_INICIAR:'Pronta para iniciar',EM_ANDAMENTO:'Em andamento',REPROVADA:'Reprovada',PENDENTE_ALOCACAO:'Pendente de alocação',EM_DESLOCAMENTO:'Em deslocamento'};
function dataCivil(date: Date) {return date.toLocaleDateString('en-CA',{timeZone:'America/Maceio'});}
function filtrosIniciais(tipo: ConsultaRelatorio['tipo']): ConsultaRelatorio {
  const hoje = new Date();
  const inicio = new Date(hoje); inicio.setUTCDate(inicio.getUTCDate()-29);
  return {tipo,inicio:dataCivil(inicio),fim:dataCivil(hoje),...(['viagens','motoristas'].includes(tipo)?{status:'CONCLUIDA'}:{})};
}

/** Consulta e exportação compartilham o mesmo snapshot; filtros alterados exigem nova geração. */
export function Relatorios({tipoInicial = 'viagens'}: {tipoInicial?: ConsultaRelatorio['tipo']}) {
  const svo = tipoInicial === 'svo';
  const [filtros,setFiltros] = useState(()=>filtrosIniciais(tipoInicial));
  const [consulta,setConsulta] = useState(filtros);
  const [pagina,setPagina] = useState(1);
  const [exportando,setExportando] = useState('');
  const [erroExportacao,setErroExportacao] = useState('');
  const exportacao = useRef<AbortController | null>(null);
  useEffect(()=>()=>exportacao.current?.abort(),[]);
  const load = useCallback((signal: AbortSignal)=>buscarRelatorio(consulta,signal),[consulta]);
  const remoto = useRemoteData(load,null);
  const recursosLoad = useCallback((signal: AbortSignal)=>buscarRecursosRelatorios(svo,signal),[svo]);
  const recursos = useRemoteData(recursosLoad,{veiculos:[],motoristas:[]} as Awaited<ReturnType<typeof buscarRecursosRelatorios>>);
  const alterados = JSON.stringify(filtros) !== JSON.stringify(consulta);
  const data = remoto.data;
  const corresponde = data && data.tipo === consulta.tipo && data.inicio === consulta.inicio && data.fim === consulta.fim &&
    data.filtros.veiculoId === (consulta.veiculoId ?? null) && data.filtros.motoristaId === (consulta.motoristaId ?? null) && data.filtros.status === (consulta.status ?? null);
  const resultado = !alterados && !remoto.loading && !remoto.error && corresponde ? data : null;
  const paginas = Math.max(1,Math.ceil((resultado?.linhas.length ?? 0)/25));
  const paginaAtual = Math.min(pagina,paginas);
  async function baixar(formato: 'csv'|'xlsx'|'pdf') {
    if (!resultado || exportando) return;
    const controller = new AbortController(); exportacao.current = controller;
    setExportando(formato);setErroExportacao('');
    try {await exportarRelatorio(resultado,formato,controller.signal);}
    catch(error) {if (!controller.signal.aborted) setErroExportacao(errorMessage(error));}
    finally {if (!controller.signal.aborted) setExportando('');}
  }
  return <section className="relatorios" aria-labelledby="relatorios-titulo">
    <header className="pagina__topo"><div><h1 id="relatorios-titulo" className="pagina__titulo">{svo?'Relatórios SVO':'Relatórios operacionais'}</h1>
      <p className="pagina__descricao">Consulte os registros da operação e exporte o resultado completo.</p></div>
      <div className="relatorios__acoes" aria-label="Exportar relatório">
        {(['csv','xlsx','pdf'] as const).map(formato=><button key={formato} className="btn btn--secundario" disabled={!resultado || !resultado.linhas.length || !!exportando} onClick={()=>void baixar(formato)}>
          {exportando===formato?'Exportando…':`Exportar ${formato.toUpperCase()}`}</button>)}
      </div>
    </header>
    <form className="cartao relatorios__filtros" onSubmit={event=>{event.preventDefault();setPagina(1);setErroExportacao('');if(alterados)setConsulta({...filtros});else remoto.retry();}}>
      <fieldset disabled={!!exportando}><legend>Filtros do relatório</legend><div className="relatorios__campos">
        {!svo && <label className="campo" htmlFor="relatorio-tipo">Relatório<Select id="relatorio-tipo" value={filtros.tipo} onChange={event=>{
          const tipo=event.target.value as ConsultaRelatorio['tipo'];setFiltros({...filtros,tipo,status:['viagens','motoristas'].includes(tipo)?'CONCLUIDA':undefined});
        }}>{Object.entries(nomes).filter(([key])=>key!=='svo').map(([key,nome])=><option key={key} value={key}>{nome}</option>)}</Select></label>}
        <label className="campo" htmlFor="relatorio-inicio">Data inicial<DatePicker id="relatorio-inicio" required value={filtros.inicio} onChange={e=>setFiltros({...filtros,inicio:e.target.value})}/></label>
        <label className="campo" htmlFor="relatorio-fim">Data final<DatePicker id="relatorio-fim" min={filtros.inicio} required value={filtros.fim} onChange={e=>setFiltros({...filtros,fim:e.target.value})}/></label>
        <label className="campo" htmlFor="relatorio-veiculo">Veículo<Select id="relatorio-veiculo" value={filtros.veiculoId ?? ''} disabled={recursos.loading || !!recursos.error} onChange={e=>setFiltros({...filtros,veiculoId:e.target.value || undefined})}>
          <option value="">Todos os veículos</option>{recursos.data.veiculos.map(v=><option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}</Select></label>
        <label className="campo" htmlFor="relatorio-motorista">Motorista<Select id="relatorio-motorista" value={filtros.motoristaId ?? ''} disabled={recursos.loading || !!recursos.error} onChange={e=>setFiltros({...filtros,motoristaId:e.target.value || undefined})}>
          <option value="">Todos os motoristas</option>{recursos.data.motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</Select></label>
        {statusPorRelatorio[filtros.tipo].length>0 && <label className="campo" htmlFor="relatorio-status">Status<Select id="relatorio-status" value={filtros.status ?? ''} onChange={e=>setFiltros({...filtros,status:e.target.value || undefined})}>
          <option value="">Todos os status</option>{statusPorRelatorio[filtros.tipo].map(status=><option key={status} value={status}>{statusTexto[status]}</option>)}</Select></label>}
      </div><div className="relatorios__gerar"><p>Até 366 dias, incluindo a data final. Limite de 5.000 registros por consulta.</p><button type="submit" className="btn btn--primario">Gerar relatório</button></div></fieldset>
    </form>
    {recursos.loading && <p role="status">Carregando opções de filtro…</p>}
    {recursos.error && <div role="alert">{recursos.error} <button className="btn btn--secundario" onClick={recursos.retry}>Tentar carregar filtros</button></div>}
    {exportando && <p role="status">Preparando arquivo {exportando.toUpperCase()} com todos os registros…</p>}
    {erroExportacao && <p role="alert">Não foi possível exportar. {erroExportacao} Tente novamente pelo botão de exportação.</p>}
    {alterados ? <p role="status" className="vazio">Filtros alterados. Selecione “Gerar relatório” para consultar e exportar o novo resultado.</p>
      : remoto.loading ? <p role="status" className="vazio">Consultando registros…</p>
      : remoto.error ? <div role="alert" className="cartao vazio"><p>{remoto.error}</p><button className="btn btn--secundario" onClick={remoto.retry}>Tentar novamente</button></div>
      : resultado && <>
        <div className="relatorios__resumo" aria-label="Resumo do relatório"><p><strong>{resultado.resumo.registros}</strong> registros encontrados</p>
          {resultado.resumo.semQuilometragem!==null && <><p><strong>{resultado.resumo.kmConcluidos===null?'Não informada':formatarCelula(resultado.resumo.kmConcluidos,'numero')+' km'}</strong> quilometragem concluída</p><p><strong>{resultado.resumo.semQuilometragem}</strong> concluídas sem km válido</p></>}
        </div>
        <article className="cartao relatorios__resultado"><header><h2>{resultado.titulo}</h2><p>{formatarCelula(resultado.inicio,'data')} a {formatarCelula(resultado.fim,'data')} · {resultado.criterioPeriodo}</p>
          <p>Gerado em {new Date(resultado.geradoEm).toLocaleString('pt-BR',{timeZone:'America/Maceio'})} (America/Maceio).</p></header>
          {!resultado.linhas.length ? <p role="status" className="vazio">Nenhum registro encontrado para os filtros selecionados.</p> : <>
            <div className="relatorios__tabela" tabIndex={0} role="region" aria-label="Tabela do relatório, com rolagem horizontal"><table><caption className="sr-only">{resultado.titulo} — página {paginaAtual} de {paginas}</caption><thead><tr>{resultado.colunas.map(c=><th key={c.chave} scope="col">{c.titulo}</th>)}</tr></thead>
              <tbody>{resultado.linhas.slice((paginaAtual-1)*25,paginaAtual*25).map((linha,index)=><tr key={index}>{resultado.colunas.map(c=><td key={c.chave}>{c.chave==='status' && typeof linha[c.chave]==='string' ? statusTexto[String(linha[c.chave])] ?? linha[c.chave] : formatarCelula(linha[c.chave],c.tipo)}</td>)}</tr>)}</tbody></table></div>
            <div className="paginacao"><span>Página {paginaAtual} de {paginas} · A exportação inclui os {resultado.resumo.registros} registros.</span><div className="paginacao__botoes"><button disabled={paginaAtual<=1} onClick={()=>setPagina(paginaAtual-1)}>Anterior</button><button disabled={paginaAtual>=paginas} onClick={()=>setPagina(paginaAtual+1)}>Próxima</button></div></div>
          </>}
        </article>
        <aside className="relatorios__notas" aria-label="Critérios e limites do relatório">{resultado.observacoes.map(nota=><p key={nota}>{nota}</p>)}</aside>
      </>}
  </section>;
}
