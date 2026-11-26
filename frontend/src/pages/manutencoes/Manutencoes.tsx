import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../app/routes/router';
import { rotaDetalheManutencao, rotaDetalheVeiculo } from '../../app/routes/rotas';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { errorMessage } from '../../shared/api/errors';
import { Paginacao } from '../../shared/components/Paginacao';
import { Select } from '../../shared/components/Select';
import {
  consultarManutencao, filtrosIniciais, historicoManutencao, listarManutencoes, listarManutencoesVeiculo,
  type Detalhe, type Evento, type Filtros, type Resumo,
} from '../../shared/services/manutencoes.service';
import { buscarVeiculos } from '../../shared/services/veiculos.service';
import { ManutencaoModal, type Operacao } from './ManutencaoModal';
import { IndicadoresManutencao } from './IndicadoresManutencao';
import { estadoBusca, identidadeBusca, lerBusca, lerRecorte, rotaComRecorte, sincronizarRecorte, type BuscaNavegacao } from './manutencoes.navegacao';
import { acoes, acoesPorEstado, dataPt, dinheiro, estados, eventos, fuso, instantePt, tipos, vinculo } from './manutencoes.form';
import './Manutencoes.css';

const vazia = {data: [], meta: {page:1, limit:20, total:0}};
const formatosKm = new Intl.NumberFormat('pt-BR');
const datasHistorico = {entrada:'Entrada', conclusaoPrevista:'Conclusão prevista', iniciadaEm:'Início efetivo',
  concluidaEm:'Conclusão efetiva', canceladaEm:'Cancelamento'} as const;

function EstadoConsulta({loading,error,retry,vazio,children}: {
  loading:boolean; error:string; retry:()=>void; vazio?:string; children?:React.ReactNode;
}) {
  if (loading) return <p role="status" className="manutencoes__estado">Carregando...</p>;
  if (error) return <div role="alert" className="manutencoes__estado manutencoes__erro">{error}{' '}
    <button className="btn btn--secundario" type="button" onClick={retry}>Tentar novamente</button></div>;
  if (vazio) return <p className="manutencoes__estado">{vazio}</p>;
  return children;
}

function Paginas({meta, mudar, rotulo}: {meta: {page:number;limit:number;total:number}; mudar:(page:number)=>void; rotulo:string}) {
  const paginas = Math.max(1, Math.ceil(meta.total / meta.limit));
  if (paginas <= 1 || meta.page > paginas) return null;
  return <Paginacao pagina={meta.page} totalPaginas={paginas} de={(meta.page-1)*meta.limit+1}
    ate={Math.min(meta.total,meta.page*meta.limit)} total={meta.total} rotulo={rotulo} aoMudar={mudar} />;
}

function Badges({item}: {item: Resumo}) {
  return <span className="manutencoes__badges">
    <span className={'manutencoes__badge manutencoes__badge--'+item.status.toLowerCase()}>{estados[item.status]}</span>
    {item.atrasada && <span className="manutencoes__badge manutencoes__badge--atraso">Atrasada</span>}
  </span>;
}

function CamposResumo({item}: {item: Resumo}) {
  return <>
    <div><dt>Entrada</dt><dd>{dataPt(item.entrada)}</dd></div>
    <div><dt>Conclusão prevista</dt><dd>{dataPt(item.conclusaoPrevista)}</dd></div>
    <div><dt>Prestador</dt><dd>{item.prestador ?? 'Não informado'}</dd></div>
    <div><dt>Custo registrado</dt><dd>{dinheiro(item.custo)}</dd></div>
  </>;
}

function Card({item, rota, editar, estado}: {item: Resumo; rota:string; editar?:()=>void; estado?:BuscaNavegacao|null}) {
  return <article className="manutencoes__card">
    <header className="manutencoes__topo">
      <h2>{item.veiculo.placa} <span>· {vinculo[item.veiculo.vinculo]}</span></h2><Badges item={item}/>
    </header>
    <p className="manutencoes__descricao">{item.descricao}</p>
    <span className="manutencoes__badge manutencoes__tipo">{tipos[item.tipo]}</span>
    <dl className="manutencoes__campos"><CamposResumo item={item}/></dl>
    <footer className="manutencoes__card-acoes">
      <Link className="btn btn--secundario" para={rota} estado={estado}>Ver detalhes</Link>
      {editar && <button className="btn manutencoes__botao-editar" type="button" onClick={editar}>Editar</button>}
    </footer>
  </article>;
}

function Historico({id}: {id:string}) {
  const [pagina,setPagina] = useState(1);
  const consultar = useCallback((signal:AbortSignal) => historicoManutencao(id,pagina,signal), [id,pagina]);
  const remoto = useRemoteData(consultar,vazia);
  function descricao(e:Evento) {
    return (Object.keys(datasHistorico) as (keyof typeof datasHistorico)[]).filter(c => e.anterior[c] !== e.posterior[c]).map(c => {
      const anterior = e.anterior[c], posterior = e.posterior[c];
      const formatar = c === 'entrada' || c === 'conclusaoPrevista' ? (data:string|null) => data ? dataPt(data) : 'Não informado' : instantePt;
      return <li key={c}><strong>{datasHistorico[c]}</strong> {formatar(anterior)} → {formatar(posterior)}</li>;
    });
  }
  return <section className="manutencoes__card" aria-label="Histórico da manutenção">
    <h2>Histórico da manutenção</h2>
    <p>Este histórico mostra conclusões, correções de datas, reaberturas, cancelamentos e reativações. Cadastro, edições comuns e início constam na Auditoria.</p>
    <EstadoConsulta {...remoto} vazio={!remoto.data.data.length ? 'Nenhum evento de histórico registrado para esta manutenção.' : undefined}>
      <ol className="manutencoes__historico">
        {remoto.data.data.map(e => <li key={e.id}>
          <h3>{eventos[e.evento]}</h3>
          <p>{estados[e.statusAnterior]} → {estados[e.statusPosterior]}</p>
          <p>Autor #{e.autorId} · {instantePt(e.registradoEm)} ({fuso})</p>
          <ul>{descricao(e)}</ul>
        </li>)}
      </ol>
      <Paginas meta={remoto.data.meta} mudar={setPagina} rotulo="eventos"/>
    </EstadoConsulta>
  </section>;
}

export function ManutencoesVeiculo({id,base}: {id:string;base:string}) {
  const [pagina,setPagina] = useState(1);
  const consultar = useCallback((signal:AbortSignal) => listarManutencoesVeiculo(id,pagina,signal), [id,pagina]);
  const remoto = useRemoteData(consultar,vazia);
  return <section className="manutencoes manutencoes--veiculo manutencoes__card" aria-label="Manutenções do veículo">
    <h2>Manutenções do veículo</h2>
    <EstadoConsulta {...remoto} vazio={!remoto.data.data.length ? 'Nenhuma manutenção registrada para este veículo.' : undefined}>
      <div className="manutencoes__grade">
        {remoto.data.data.map(item => <Card key={item.id} item={item} rota={rotaDetalheManutencao(base,item.id)}/>)}
      </div>
      <Paginas meta={remoto.data.meta} mudar={setPagina} rotulo="manutenções"/>
    </EstadoConsulta>
  </section>;
}

export function Manutencoes({base, id}: {base:string; id?:string}) {
  const [recorte] = useState(() => lerRecorte(window.location.search));
  const [filtros,setFiltros] = useState<Filtros>(recorte.filtros);
  const [busca,setBusca] = useState('');
  const [pagina,setPagina] = useState(recorte.pagina);
  const [sessaoBusca,setSessaoBusca] = useState<string | null>(null);
  const [restaurando,setRestaurando] = useState(() => Boolean(window.history.state?.manutencoes));
  useEffect(() => {
    let ativo = true;
    const entrada = window.history.state;
    void identidadeBusca().catch(() => null).then(sessao => {
      if (!ativo) return;
      const identidade = sessao ? sessao + ':' + base : null;
      const q = lerBusca(entrada,identidade);
      setSessaoBusca(identidade);
      if (entrada?.manutencoes) {
        setBusca(q);
        setFiltros(f => ({...f,q}));
      }
      setRestaurando(false);
    });
    return () => { ativo = false; };
  }, []);
  const [operacao,setOperacao] = useState<Operacao>();
  const [aviso,setAviso] = useState<{mensagem:string; id?:string}>();
  const [revisao,setRevisao] = useState(0);
  const [acessoNegado,setAcessoNegado] = useState(false);
  const catalogo = useRemoteData(buscarVeiculos,[]);
  const intervaloInvalido = Boolean(filtros.inicio && filtros.fim && filtros.inicio > filtros.fim);
  const chaveLista = JSON.stringify([pagina,filtros,revisao]);
  const consultar = useCallback(async (signal:AbortSignal) => {
    if (id || intervaloInvalido || acessoNegado || restaurando) return {...vazia,chave:chaveLista,erro:''};
    try {
      return {...await listarManutencoes(pagina,filtros,signal),chave:chaveLista,erro:''};
    } catch (falha) {
      return {...vazia,chave:chaveLista,erro:errorMessage(falha)};
    }
  }, [id,pagina,filtros,intervaloInvalido,acessoNegado,restaurando,chaveLista]);
  const consultarDetalhe = useCallback(async (signal:AbortSignal) => id && !acessoNegado ? consultarManutencao(id,signal) : null, [id,acessoNegado]);
  const lista = useRemoteData(consultar,{...vazia,chave:'',erro:''});
  const listaCarregando = lista.loading || lista.data.chave !== chaveLista;
  const erroLista = listaCarregando ? '' : lista.data.erro;
  const detalhe = useRemoteData(consultarDetalhe,null);
  const totalPaginas = Math.max(1,Math.ceil(lista.data.meta.total / lista.data.meta.limit));
  const buscaPendente = busca.trim() !== filtros.q;
  useEffect(() => {
    if (!buscaPendente) return;
    const timer = window.setTimeout(() => {
      setFiltros(f => ({...f,q:busca.trim()})); setPagina(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [busca,buscaPendente]);
  useEffect(() => {
    if (!listaCarregando && !erroLista && lista.data.meta.page === pagina && pagina > totalPaginas) setPagina(totalPaginas);
  }, [listaCarregando,erroLista,lista.data.meta.page,pagina,totalPaginas]);
  function filtrar<K extends keyof Filtros>(chave:K, valor:Filtros[K]) {
    setFiltros(f => ({...f,[chave]:valor})); setPagina(1);
  }
  function atualizar() {
    if (id) {
      detalhe.setData(detalhe.data);
      detalhe.retry();
    } else {
      lista.setData(lista.data);
      lista.retry();
    }
  }
  function salvo(d:Detalhe,cadastro:boolean) {
    if (id) { detalhe.setData(d); detalhe.retry(); }
    else atualizar();
    setOperacao(undefined);
    setAviso({mensagem: cadastro ? 'Manutenção registrada.' : 'Alteração confirmada.', id: cadastro ? d.id : undefined});
    setRevisao(r => r + 1);
  }
  const retorno = rotaComRecorte(base,filtros,pagina);
  const rota = (id:string) => rotaComRecorte(rotaDetalheManutencao(base,id),filtros,pagina);
  const qNavegacao = id ? filtros.q : busca;
  const estado = estadoBusca(sessaoBusca,qNavegacao);
  const gravarRecorte = useCallback(() => {
    if (!id && !restaurando && !acessoNegado && window.location.pathname === base) {
      sincronizarRecorte(retorno,estadoBusca(sessaoBusca,qNavegacao));
    }
  },[base,id,restaurando,acessoNegado,retorno,sessaoBusca,qNavegacao]);
  useEffect(gravarRecorte,[gravarRecorte]);

  const perderAcesso = useCallback(() => {
    setOperacao(undefined); setAviso(undefined); setAcessoNegado(true);
  }, []);
  const d = detalhe.data;
  const ativos = Object.values(filtros).some(Boolean);
  if (acessoNegado) return <section className="manutencoes">
    <p role="alert">Você não tem mais acesso a esta manutenção.</p>
    <Link para={retorno}>Voltar para manutenções</Link>
  </section>;
  return <section className="manutencoes">
    {aviso && <p role="status" className="manutencoes__aviso">{aviso.mensagem} {aviso.id && <Link para={rota(aviso.id)} estado={estado}>Ver detalhes da manutenção</Link>}</p>}
    {id ? <>
      <Link className="btn btn--secundario" para={retorno} estado={estado}>‹ Voltar para manutenções</Link>
      {detalhe.error || !d ? <EstadoConsulta {...detalhe}/> : <>
        <article className="manutencoes__card manutencoes__detalhe">
          <header className="manutencoes__topo">
            <div><h1>Manutenção do veículo {d.veiculo.placa}</h1><p>{vinculo[d.veiculo.vinculo]} · {tipos[d.tipo]}</p></div>
            <Badges item={d}/>
          </header>
          <p className="manutencoes__descricao">{d.descricao}</p>
          <dl className="manutencoes__campos">
            <CamposResumo item={d}/>
            <div><dt>Quilometragem</dt><dd>{formatosKm.format(d.quilometragem)} km</dd></div>
            <div><dt>Início efetivo</dt><dd>{instantePt(d.iniciadaEm)}</dd></div>
            <div><dt>Conclusão efetiva</dt><dd>{instantePt(d.concluidaEm)}</dd></div>
            {d.canceladaEm && <div><dt>Cancelamento</dt><dd>{instantePt(d.canceladaEm)}</dd></div>}
            <div className="manutencoes__largo"><dt>Observações</dt><dd>{d.observacoes ?? 'Não informado'}</dd></div>
          </dl>
          <footer className="manutencoes__card-acoes">
            <Link className="btn btn--secundario" para={rotaDetalheVeiculo(d.veiculo.id)}>Ver veículo</Link>
            <button className="btn btn--secundario" type="button" onClick={() => setOperacao({modo:'edicao',id})}>Editar</button>
            {acoesPorEstado[d.status].map(acao => <button key={acao} className="btn btn--primario" type="button"
              onClick={() => setOperacao({modo:acao,id})}>{acoes[acao]}</button>)}
          </footer>
        </article>
        <Historico key={revisao} id={id}/>
      </>}
    </> : <>
      <header className="manutencoes__topo manutencoes__cabecalho">
        <div><h1>Manutenções</h1><p>Serviços, prazos e custos da frota.</p></div>
        <button className="btn btn--primario" type="button" onClick={() => setOperacao({modo:'cadastro'})}><span aria-hidden="true">＋</span> Registrar manutenção</button>
      </header>
      {!restaurando && !intervaloInvalido && <IndicadoresManutencao
        filtros={filtros} revisao={revisao} rota={rota} estado={estado} aoPerderAcesso={perderAcesso}/>}
      <section className="manutencoes__filtros" aria-label="Filtros de manutenção">
        <label>Veículo<Select value={filtros.veiculoId} onChange={e=>filtrar('veiculoId',e.target.value)} disabled={catalogo.loading || !!catalogo.error}>
          <option value="">Todos os veículos</option>
          {catalogo.data.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}
        </Select></label>
        <label>Tipo<Select value={filtros.tipo} onChange={e=>filtrar('tipo',e.target.value as Filtros['tipo'])}>
          <option value="">Todos os tipos</option>{Object.entries(tipos).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </Select></label>
        <label>Status<Select value={filtros.status} onChange={e=>filtrar('status',e.target.value as Filtros['status'])}>
          <option value="">Todos os status</option>{Object.entries(estados).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </Select></label>
        <label>Entrada a partir de<input type="date" value={filtros.inicio} onChange={e=>filtrar('inicio',e.target.value)}/></label>
        <label>Entrada até<input type="date" value={filtros.fim} onChange={e=>filtrar('fim',e.target.value)} aria-invalid={intervaloInvalido}/></label>
        <label>Buscar<input type="search" value={busca} maxLength={255} placeholder="Placa, descrição ou prestador" onChange={e=>setBusca(e.target.value)}/></label>
        {(ativos || busca) && <button className="btn btn--secundario" type="button" onClick={() => {setBusca('');setFiltros(filtrosIniciais);setPagina(1);}}>Limpar filtros</button>}
        {!listaCarregando && !erroLista && !intervaloInvalido && !buscaPendente && !restaurando &&
          <span className="manutencoes__total" role="status">{lista.data.meta.total} {lista.data.meta.total === 1 ? 'registro' : 'registros'}</span>}
      </section>
      {catalogo.error && <p role="alert" className="manutencoes__erro">{catalogo.error}{' '}<button className="btn btn--secundario" type="button" onClick={catalogo.retry}>Tentar novamente o catálogo</button></p>}
      {intervaloInvalido ? <p role="alert" className="manutencoes__erro">A entrada final deve ser igual ou posterior à inicial.</p>
        : <EstadoConsulta {...lista} error={erroLista} loading={listaCarregando || buscaPendente || restaurando} vazio={!lista.data.data.length
          ? ativos ? 'Nenhuma manutenção encontrada para os filtros.' : 'Nenhuma manutenção registrada.' : undefined}>
          <div className="manutencoes__grade">
            {lista.data.data.map(item => <Card key={item.id} item={item} rota={rota(item.id)} estado={estado}
              editar={() => setOperacao({modo:'edicao',id:item.id})}/>)}
          </div>
          <Paginas meta={lista.data.meta} mudar={setPagina} rotulo="manutenções"/>
        </EstadoConsulta>}
    </>}
    {operacao && <ManutencaoModal operacao={operacao} veiculos={catalogo.data} catalogoCarregando={catalogo.loading}
      catalogoErro={catalogo.error} recarregarCatalogo={catalogo.retry} aoFechar={()=>setOperacao(undefined)}
      aoSalvar={salvo} aoAtualizarEstado={atualizar} rotaDetalhe={rota}
      aoPerderAcesso={perderAcesso}/>}
  </section>;
}
