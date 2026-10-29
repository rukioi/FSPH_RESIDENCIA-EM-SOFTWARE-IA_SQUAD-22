import "./AtividadeRecente.css";

export type AtividadeSvo = {
  id: number;
  titulo: string;
  descricao: string;
  horario: string;
};

type AtividadeRecenteProps = {
  atividades: AtividadeSvo[];
};

export function AtividadeRecente({
  atividades,
}: AtividadeRecenteProps) {
  return (
    <section className="svo-atividade">
      <header className="svo-atividade__cabecalho">
        <div>
          <h2>Atividade recente</h2>
          <p>Últimas movimentações do SVO</p>
        </div>
      </header>

      <div className="svo-atividade__lista">
        {atividades.map((atividade) => (
          <article
            key={atividade.id}
            className="svo-atividade__item"
          >
            <div className="svo-atividade__marcador" />

            <div className="svo-atividade__conteudo">
              <strong>{atividade.titulo}</strong>
              <p>{atividade.descricao}</p>
            </div>

            <time>{atividade.horario}</time>
          </article>
        ))}

        {atividades.length === 0 && (
          <p className="svo-atividade__vazio">
            Nenhuma atividade recente.
          </p>
        )}
      </div>
    </section>
  );
}
