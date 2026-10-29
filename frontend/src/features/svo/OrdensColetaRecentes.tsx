import type { OrdemColeta } from "./AguardandoDespacho";
import type { OrdemPronta } from "./ProntasParaIniciar";
import "./OrdensColetaRecentes.css";

type OrdensColetaRecentesProps = {
  aguardando: OrdemColeta[];
  prontas: OrdemPronta[];
  onPrepararDespacho: (ordem: OrdemColeta) => void;
};

export function OrdensColetaRecentes({
  aguardando,
  prontas,
  onPrepararDespacho,
}: OrdensColetaRecentesProps) {
  const recentes = [
    ...aguardando.map((ordem) => ({
      ...ordem,
      status: "Aguardando despacho" as const,
    })),
    ...prontas.map((ordem) => ({
      ...ordem,
      status: "Em andamento" as const,
    })),
  ]
    .sort((a, b) => b.apiId - a.apiId)
    .slice(0, 3);

  return (
    <section className="svo-recentes">
      <header className="svo-recentes__cabecalho">
        <h2>Ordens de coleta recentes</h2>

        <button type="button" className="svo-recentes__ver-todas">
          Ver todas
        </button>
      </header>

      <div className="svo-recentes__lista">
        {recentes.map((ordem) => (
          <article key={ordem.id} className="svo-recentes__item">
            <div>
              <div className="svo-recentes__linha">
                <strong>#{ordem.id}</strong>

                <span
                  className={
                    ordem.status === "Aguardando despacho"
                      ? "svo-recentes__status svo-recentes__status--aguardando"
                      : "svo-recentes__status svo-recentes__status--pronta"
                  }
                >
                  ● {ordem.status}
                </span>
              </div>

              <p>
                Solicitação {ordem.solicitacaoCodigo ?? "—"} · {ordem.endereco} ·
                Gerada {ordem.horario}
              </p>
            </div>

            <button
              type="button"
              className="svo-recentes__acao"
              onClick={() =>
                ordem.status === "Aguardando despacho"
                  ? onPrepararDespacho(ordem)
                  : undefined
              }
              disabled={ordem.status !== "Aguardando despacho"}
            >
              Ver ordem
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
