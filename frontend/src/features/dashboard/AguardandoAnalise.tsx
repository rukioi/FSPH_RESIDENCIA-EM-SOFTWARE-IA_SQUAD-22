import { useState } from "react";
import "../../app/AguardandoAnalise.css";

type Chamado = {
  codigo: string;
  instituicao: string;
  origem: string;
  destino: string;
  data: string;
  horario: string;
  passageiros: number;
};

type TipoAcao = "visualizar" | "aprovar" | "rejeitar" | "editar";

const chamadosMockados: Chamado[] = [
  {
    codigo: "TRP-1024",
    instituicao: "Hemose",
    origem: "Hemose",
    destino: "Hospital Universitário",
    data: "24/09/2026",
    horario: "14:00",
    passageiros: 3,
  },
  {
    codigo: "TRP-1025",
    instituicao: "Laboratório Central",
    origem: "Laboratório Central",
    destino: "Unidade Messejana",
    data: "25/09/2026",
    horario: "09:30",
    passageiros: 2,
  },
];

const acoes: { tipo: TipoAcao; nome: string }[] = [
  { tipo: "visualizar", nome: "Visualizar" },
  { tipo: "aprovar", nome: "Aprovar" },
  { tipo: "rejeitar", nome: "Rejeitar" },
  { tipo: "editar", nome: "Editar" },
];

const iconesAcao: Record<TipoAcao, string> = {
  visualizar:
    "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
  aprovar: "M20 6 9 17l-5-5",
  rejeitar: "M18 6 6 18 M6 6l12 12",
  editar: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5Z",
};

/** Expõe as interações locais existentes como demonstração sem prometer gravação na API. */
export function AguardandoAnalise() {
  const [selecao, setSelecao] = useState<{
    acao: TipoAcao;
    chamado: Chamado;
  } | null>(null);

  return (
    <section className="analise" aria-labelledby="analise-titulo">
      <header className="analise__cabecalho">
        <div>
          <h2 id="analise-titulo">Aguardando análise</h2>
          <p>Demonstração — {chamadosMockados.length} chamados ilustrativos, sem integração.</p>
        </div>

        <button
          type="button"
          className="analise__link"
          onClick={() =>
            document.getElementById("analise-lista")?.scrollIntoView({
              behavior: "smooth",
            })
          }
        >
          Ver pendentes →
        </button>
      </header>

      <div className="analise__tabela" id="analise-lista">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Trajeto</th>
              <th>Data e passageiros</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {chamadosMockados.map((chamado) => (
              <tr key={chamado.codigo}>
                <td data-label="Código">
                  <span className="analise__alerta" aria-hidden="true">
                    ⚠
                  </span>
                  <strong>#{chamado.codigo}</strong>
                </td>

                <td data-label="Trajeto">
                  {chamado.instituicao} · {chamado.origem} → {chamado.destino}
                </td>

                <td data-label="Data e passageiros">
                  {chamado.data} · {chamado.horario} · {chamado.passageiros}{" "}
                  pass.
                </td>

                <td data-label="Ações">
                  <div className="analise__acoes">
                    {acoes.map((acao) => (
                      <button
                        key={acao.tipo}
                        type="button"
                        className={`analise__botao analise__botao--${acao.tipo}`}
                        aria-label={`${acao.nome} chamado ${chamado.codigo}`}
                        title={acao.nome}
                        onClick={() =>
                          setSelecao({
                            acao: acao.tipo,
                            chamado,
                          })
                        }
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d={iconesAcao[acao.tipo]} />

                          {acao.tipo === "visualizar" && (
                            <circle cx="12" cy="12" r="3" />
                          )}
                        </svg>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selecao && (
        <div className="analise__mensagem" role="status">
          <strong>
            {acoes.find((acao) => acao.tipo === selecao.acao)?.nome}
            {" — #"}
            {selecao.chamado.codigo}
          </strong>

          <p>
            {selecao.acao === "visualizar"
              ? `${selecao.chamado.origem} → ${selecao.chamado.destino}. ${selecao.chamado.passageiros} passageiros.`
              : "Ação demonstrativa. A integração com a API ainda está pendente. Nenhuma alteração foi salva."}
          </p>

          <button type="button" onClick={() => setSelecao(null)}>
            Fechar
          </button>
        </div>
      )}
    </section>
  );
}
