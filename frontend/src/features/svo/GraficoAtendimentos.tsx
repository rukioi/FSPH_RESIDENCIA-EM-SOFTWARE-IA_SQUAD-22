import "./GraficoAtendimentos.css";

const dadosChamados = [
  {
    nome: "Pendentes",
    quantidade: 2,
    classe: "svo-grafico__cor--amarelo",
  },
  {
    nome: "Agendados",
    quantidade: 2,
    classe: "svo-grafico__cor--azul-claro",
  },
  {
    nome: "Prontas para iniciar",
    quantidade: 0,
    classe: "svo-grafico__cor--verde",
  },
  {
    nome: "Em andamento",
    quantidade: 1,
    classe: "svo-grafico__cor--azul",
  },
  {
    nome: "Concluídos",
    quantidade: 2,
    classe: "svo-grafico__cor--verde-escuro",
  },
  {
    nome: "Reprovados",
    quantidade: 0,
    classe: "svo-grafico__cor--vermelho",
  },
];

export function GraficoAtendimentos() {
  const total = dadosChamados.reduce(
    (soma, item) => soma + item.quantidade,
    0,
  );

  return (
    <section className="svo-grafico">
      <header className="svo-grafico__cabecalho">
        <div>
          <h2>Visão geral dos chamados</h2>
          <small>Dados ilustrativos</small>
        </div>

        <button type="button" className="svo-grafico__link">
          Ver solicitações →
        </button>
      </header>

      <div className="svo-grafico__conteudo">
        <div className="svo-grafico__donut">
          <div className="svo-grafico__centro">
            <span>TOTAL</span>
            <strong>{total}</strong>
            <small>chamados</small>
          </div>
        </div>

        <div className="svo-grafico__legenda">
          {dadosChamados.map((item) => (
            <div
              key={item.nome}
              className="svo-grafico__legenda-item"
            >
              <span
                className={`svo-grafico__cor ${item.classe}`}
                aria-hidden="true"
              />

              <span className="svo-grafico__nome">
                {item.nome}
              </span>

              <strong>{item.quantidade}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
