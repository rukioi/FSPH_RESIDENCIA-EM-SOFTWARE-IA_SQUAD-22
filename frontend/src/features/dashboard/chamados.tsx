import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Painel, Vazio } from "../../features/dashboard/Painel";

interface ChamadosData {
  pendentes: number;
  prontosParaIniciar: number;
  concluidos: number;
  agendados: number;
  emAndamento: number;
  reprovados: number;
}

interface ChamadosProps {
  dados?: ChamadosData;
  demonstracao?: boolean;
}

const DEMO: ChamadosData = {
  pendentes: 2,
  prontosParaIniciar: 0,
  concluidos: 2,
  agendados: 2,
  emAndamento: 1,
  reprovados: 0,
};

const statusChamados: Array<{
  chave: keyof ChamadosData;
  label: string;
  cor: string;
}> = [
  { chave: "pendentes", label: "Pendentes", cor: "#c98200" },
  { chave: "agendados", label: "Agendados", cor: "#5c9bdd" },
  { chave: "prontosParaIniciar", label: "Prontos para iniciar", cor: "#21864b" },
  { chave: "emAndamento", label: "Em andamento", cor: "#2866c7" },
  { chave: "concluidos", label: "Concluídos", cor: "#21864b" },
  { chave: "reprovados", label: "Reprovados", cor: "#d52b36" },
];

export function Chamados({
  dados,
  demonstracao = false,
}: ChamadosProps) {
  const informacoes = dados ?? (demonstracao ? DEMO : undefined);

  const total = informacoes
    ? Object.values(informacoes).reduce(
        (soma, quantidade) => soma + quantidade,
        0,
      )
    : 0;

  const fatias = useMemo(() => {
    if (!informacoes || total === 0) return "#e9eef5 0% 100%";

    let inicio = 0;

    return statusChamados
      .filter(({ chave }) => informacoes[chave] > 0)
      .map(({ chave, cor }) => {
        const fim = inicio + (informacoes[chave] / total) * 100;
        const parte = `${cor} ${inicio}% ${fim}%`;
        inicio = fim;
        return parte;
      })
      .join(", ");
  }, [informacoes, total]);

  const donutStyle: CSSProperties = {
    width: 156,
    height: 156,
    maxWidth: "100%",
    borderRadius: "50%",
    background: `conic-gradient(${fatias})`,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    margin: "0 auto",
  };

  return (
    <Painel
      titulo="Visão geral dos chamados"
      classe="painel-operacional--chamados"
      demonstracao={demonstracao}
      linkTexto="Ver solicitações"
      linkHref="/solicitacoes"
    >
      {!informacoes ? (
        <Vazio />
      ) : (
        <div
          className="chamados-resumo"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 245px), 1fr))",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            className="chamados-resumo__grafico"
            style={{ display: "grid", placeItems: "center" }}
          >
            <div
              style={donutStyle}
              role="img"
              aria-label={`Total de ${total} chamados`}
            >
              <div
                className="chamados-resumo__centro"
                style={{
                  width: "68%",
                  height: "68%",
                  borderRadius: "50%",
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#53627a",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Total
                </span>
                <strong
                  style={{
                    color: "#111827",
                    fontSize: 25,
                    lineHeight: 1.15,
                  }}
                >
                  {total}
                </strong>
                <span style={{ fontSize: 12 }}>chamados</span>
              </div>
            </div>
          </div>

          <ul
            className="chamados-resumo__legenda"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px 18px",
            }}
          >
            {statusChamados.map(({ chave, label, cor }) => (
              <li
                key={chave}
                style={{
                  display: "grid",
                  gridTemplateColumns: "10px 1fr auto",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: cor,
                  }}
                />
                <span style={{ color: "#667085", fontSize: 14 }}>
                  {label}
                </span>
                <strong style={{ fontSize: 14, color: "#101828" }}>
                  {informacoes[chave]}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Painel>
  );
}



