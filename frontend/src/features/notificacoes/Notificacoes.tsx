import { useNotificacoes } from './NotificacoesContext';
import { Icone } from '../../shared/components/Icone';
import type { FiltroNotificacoes } from '../../shared/services/notificacoes.service';
import './Notificacoes.css';

const filtros: {valor:FiltroNotificacoes;rotulo:string}[] = [
  {valor:'todas',rotulo:'Todas'},{valor:'nao-lidas',rotulo:'Não lidas'},{valor:'lidas',rotulo:'Lidas'},
];
const categoria = {informacao:'Informação',atencao:'Atenção',urgente:'Vencido',sucesso:'Confirmação'};
const dataHora = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Maceio'});

/** Caixa individual com filtros no servidor e leitura confirmada antes de atualizar a lista. */
export function Notificacoes() {
  const caixa = useNotificacoes();
  const {data,loading,error,erroAcao,salvando} = caixa;
  const paginas = Math.max(1,Math.ceil(data.meta.total/data.meta.limit));
  return <section className="notificacoes" aria-labelledby="notificacoes-titulo">
    <header className="notificacoes__cabecalho">
      <div><h1 id="notificacoes-titulo">Notificações</h1>
        <p aria-live="polite">{loading ? 'Atualizando sua caixa…' : error ? 'Sua caixa está temporariamente indisponível' : `${data.meta.naoLidas} ${data.meta.naoLidas===1?'não lida':'não lidas'}`}</p></div>
      <button type="button" className="btn btn--secundario" disabled={loading || !!error || salvando || !data.meta.naoLidas}
        onClick={()=>void caixa.ler()}>{salvando?'Salvando…':'Marcar todas como lidas'}</button>
    </header>
    {erroAcao && <div role="alert" className="notificacoes__erro">{erroAcao} <button className="btn" onClick={()=>caixa.retry()}>Atualizar caixa</button></div>}
    <div className="notificacoes__caixa" aria-busy={loading || salvando}>
      <div className="notificacoes__filtros">
        <div role="group" aria-label="Filtrar notificações" className="notificacoes__segmentos">
          {filtros.map(f=><button key={f.valor} type="button" aria-pressed={caixa.filtro===f.valor}
            disabled={salvando} onClick={()=>caixa.filtrar(f.valor)}>{f.rotulo}</button>)}
        </div>
        <span>{!loading && !error && `${data.meta.total} ${data.meta.total===1?'notificação':'notificações'}`}</span>
      </div>
      {error ? <div className="notificacoes__estado" role="alert"><h2>Não foi possível carregar as notificações</h2><p>{error}</p>
        <button type="button" className="btn btn--secundario" onClick={caixa.retry}>Tentar novamente</button></div>
      : loading ? <div className="notificacoes__estado" role="status">Carregando notificações…</div>
      : !data.data.length ? <div className="notificacoes__estado" role="status"><Icone nome="notificacoes" tamanho={32} />
        <h2>{caixa.filtro==='nao-lidas'?'Tudo em dia!':'Nenhuma notificação por aqui'}</h2><p>{caixa.filtro==='nao-lidas'?'Você já leu todos os avisos.':'Os avisos da sua operação aparecerão nesta caixa.'}</p></div>
      : <ul className="notificacoes__lista">{data.data.map(n=><li key={n.id} className={`notificacoes__item ${n.lidaEm?'':'notificacoes__item--nova'}`}>
        <span className={`notificacoes__ponto notificacoes__ponto--${n.categoria}`} aria-hidden="true" />
        <div className="notificacoes__texto"><span className="sr-only">{categoria[n.categoria]}: </span><h2>{n.titulo}</h2><p>{n.descricao}</p></div>
        <div className="notificacoes__meta"><time dateTime={n.criadoEm}>{dataHora.format(new Date(n.criadoEm))}</time>
          {n.lidaEm ? <span className="notificacoes__lida">Lida</span> : <button type="button" className="notificacoes__ler" disabled={salvando}
            title="Marcar como lida" aria-label={`Marcar como lida: ${n.titulo}`} onClick={()=>void caixa.ler(n.id)}>Marcar como lida</button>}</div>
      </li>)}</ul>}
      {!error && !loading && paginas>1 && <nav className="notificacoes__paginacao" aria-label="Paginação das notificações">
        <button type="button" className="btn" disabled={caixa.page===1 || salvando} onClick={()=>caixa.setPage(caixa.page-1)}>Anterior</button>
        <span>Página {caixa.page} de {paginas}</span>
        <button type="button" className="btn" disabled={caixa.page>=paginas || salvando} onClick={()=>caixa.setPage(caixa.page+1)}>Próxima</button>
      </nav>}
    </div>
  </section>;
}
