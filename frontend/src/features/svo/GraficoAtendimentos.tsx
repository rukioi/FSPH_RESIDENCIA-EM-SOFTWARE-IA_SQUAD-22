import "./GraficoAtendimentos.css";
import type { DashboardOperacionalSvo } from '../../shared/types/svo';

/** A distribuição usa apenas a coorte retornada; total zero não produz proporções fictícias. */
export function GraficoAtendimentos({dados,carregando=false}:{dados:DashboardOperacionalSvo['visaoGeral']|null;carregando?:boolean}) {
  const categorias=[
    {chave:'aguardandoTriagem',nome:'Aguardando triagem',cor:'#9a6700'},
    {chave:'confirmadasSvo',nome:'Confirmadas SVO',cor:'#238451'},
    {chave:'encaminhadasIml',nome:'Encaminhadas ao IML',cor:'#2f6fc7'},
    {chave:'semClassificacao',nome:'Sem classificação',cor:'#667085'},
  ] as const;
  const total=dados ? categorias.reduce((soma,item)=>soma+dados[item.chave],0) : 0;
  let angulo=0;
  const partes=total>0 && dados ? categorias.map(item=>{
    const inicio=angulo;angulo+=dados[item.chave]/total*360;
    return `${item.cor} ${inicio}deg ${angulo}deg`;
  }) : [];
  return (
    <section className="svo-grafico">
      <header className="svo-grafico__cabecalho"><h2>Visão geral dos atendimentos</h2></header>
      <div className="svo-grafico__conteudo">
        {!dados ? <p>{carregando?'Carregando distribuição…':'Distribuição indisponível.'}</p> : <>
          {total>0 ? <div className="svo-grafico__donut" aria-hidden="true" style={{background:`conic-gradient(${partes.join(',')})`}}>
            <div className="svo-grafico__centro"><strong>{total}</strong><small>solicitações</small></div>
          </div> : <p>Nenhuma solicitação criada no período.</p>}
          <div className="svo-grafico__legenda" aria-label="Distribuição por estado">
            {categorias.map(item=><div className="svo-grafico__legenda-item" key={item.chave}>
              <i className="svo-grafico__cor" aria-hidden="true" style={{background:item.cor}}/><span>{item.nome}</span><strong>{dados[item.chave]}</strong>
            </div>)}
          </div>
        </>}
      </div>
      <p className="svo-grafico__nota">Situação atual das solicitações criadas no período. Pode diferir das decisões realizadas no período.</p>
    </section>
  );
}
