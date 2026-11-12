import type { ListaOrdensSvo } from '../../shared/types/svo';
import { Link } from '../../app/routes/router';
import { ROTAS, rotaOrdemSvo } from '../../app/routes/rotas';
import { estadosOrdem, nomeStatusSvo } from './apresentacaoSvo';
import './OrdensColetaRecentes.css';

export type ConsultaRecentes = {
  data: ListaOrdensSvo | null;
  loading: boolean;
  error: string;
  retry: () => void;
};

/** A primeira página da API já vem ordenada por ID decrescente e inclui todos os estados. */
export function OrdensColetaRecentes({ data, loading, error, retry }: ConsultaRecentes) {
  return (
    <section className="svo-recentes">
      <header className="svo-recentes__cabecalho">
        <h2>Ordens de coleta recentes</h2>

        <Link para={ROTAS.svoOrdens} className="svo-recentes__ver-todas">
          Ver todas
        </Link>
      </header>

      {loading && <p role="status">Consultando ordens recentes…</p>}
      {error && <div className="svo-acoes"><p role="alert">{error}</p><button onClick={retry}>Tentar consultar ordens recentes</button></div>}
      {!loading && !error && data && <div className="svo-recentes__lista">
        {!data.data.length && <p>Nenhuma ordem de coleta registrada.</p>}
        {data.data.slice(0, 3).map((ordem) => (
          <article key={ordem.id} className="svo-recentes__item">
            <div>
              <div className="svo-recentes__linha">
                <strong>{ordem.codigo}</strong>

                <span
                  className={
                    ordem.status === "PENDENTE_ALOCACAO"
                      ? "svo-recentes__status svo-recentes__status--aguardando"
                      : "svo-recentes__status svo-recentes__status--pronta"
                  }
                >
                  ● {nomeStatusSvo(ordem.status, estadosOrdem)}
                </span>
              </div>

              <p>
                Solicitação {ordem.solicitacaoCodigo} · Quantidade de corpos: {ordem.quantidadeCorpos ?? "não informada"}
              </p>
            </div>

            {/^[1-9]\d*$/.test(ordem.id) && <Link para={rotaOrdemSvo(ordem.id)} className="svo-recentes__acao">Ver ordem</Link>}
          </article>
        ))}
      </div>}
    </section>
  );
}
