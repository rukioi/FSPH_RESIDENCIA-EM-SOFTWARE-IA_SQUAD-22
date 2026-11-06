import "./AtividadeRecente.css";
import type { AtividadesRecentesSvo } from '../../shared/types/svo';
import { dataCivilSvo } from './apresentacaoSvo';

/** Apresenta eventos persistidos; não reconstrói auditoria a partir de ações locais. */
export function AtividadeRecente({dados,carregando,erro,tentar}:{dados:AtividadesRecentesSvo|null;carregando:boolean;erro:string;tentar:()=>void}) {
  return (
    <section className="svo-atividade">
      <header className="svo-atividade__cabecalho"><h2>Atividade recente</h2></header>
      <div className="svo-atividade__lista">
        {carregando ? <p className="svo-atividade__vazio" role="status">Carregando atividades…</p> : erro ? <div className="svo-atividade__vazio svo-acoes">
          <p role="alert">Histórico de atividades indisponível. {erro}</p><button onClick={tentar}>Tentar atividades novamente</button>
        </div> : dados && (!dados.data.length ? <p className="svo-atividade__vazio">Nenhuma atividade SVO registrada.</p> : dados.data.map(item=><article className="svo-atividade__item" key={item.id}>
          <span className="svo-atividade__marcador" aria-hidden="true"/><div className="svo-atividade__conteudo"><strong>{item.descricao}</strong><p>{item.usuarioNome ?? 'Responsável não informado'}</p></div>
          <time dateTime={item.dataHora ?? undefined}>{dataCivilSvo(item.dataHora)}</time>
        </article>))}
      </div>
    </section>
  );
}
