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
      status: "Pronta para iniciar" as const,
    })),
  ]
    .sort((a, b) => b.id.localeCompare(a.id))
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
        {recentes.map((ordem, index) => (
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
                Solicitação #SVO-{1042 + index} · {ordem.endereco} ·
                Gerada {ordem.horario}
              </p>
            </div>

            <button
              type="button"
              className="svo-recentes__acao"
            >
              Ver ordem
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
