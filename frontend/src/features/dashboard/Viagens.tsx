import { Painel, Vazio } from "../../features/dashboard/Painel";

interface ViagemResumo {
  id: string | number;
  horario: string;
  codigo: string;
  origem: string;
  destino: string;
  status: string;
}

interface ViagensData {
  viagens: ViagemResumo[];
}

interface ViagensProps {
  dados?: ViagensData;
  demonstracao?: boolean;
}

const DEMO: ViagensData = {
  viagens: [
    {
      id: "v1",
      horario: "16:20",
      codigo: "#TRP-1021",
      origem: "Hemose",
      destino: "Unidade Messejana",
      status: "Agendada",
    },
    {
      id: "v2",
      horario: "17:00",
      codigo: "#TRP-1020",
      origem: "Laboratório Central",
      destino: "Hospital Regional",
      status: "Aguardando início",
    },
  ],
};

export function Viagens({ dados, demonstracao = false }: ViagensProps) {
  const informacoes = dados ?? (demonstracao ? DEMO : undefined);

  return (
    <Painel
      titulo="Próximas viagens"
      classe="painel-operacional--viagens"
      demonstracao={demonstracao}
      linkTexto="Ver todas as solicitações"
      linkHref="/solicitacoes"
    >
      {!informacoes || informacoes.viagens.length === 0 ? (
        <Vazio />
      ) : (
        <ol
          className="proximas-viagens__lista"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {informacoes.viagens.map((viagem, indice) => (
            <li
              className="proximas-viagens__item"
              key={viagem.id}
              style={{
                display: "grid",
                gridTemplateColumns: "50px minmax(0, 1fr)",
                gap: 10,
                padding: "4px 0 14px",
                borderBottom:
                  indice < informacoes.viagens.length - 1
                    ? "1px solid #e1e6ed"
                    : undefined,
                marginBottom: indice < informacoes.viagens.length - 1 ? 12 : 0,
              }}
            >
              <time
                style={{
                  color: "#172033",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {viagem.horario}
              </time>

              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    color: "#667085",
                    fontSize: 12,
                    marginBottom: 2,
                  }}
                >
                  {viagem.codigo}
                </span>

                <span
                  style={{
                    display: "block",
                    color: "#172033",
                    fontSize: 14,
                    overflowWrap: "anywhere",
                  }}
                >
                  {viagem.origem} → {viagem.destino}
                </span>

                <span
                  style={{
                    display: "inline-block",
                    marginTop: 5,
                    borderRadius: 6,
                    padding: "3px 8px",
                    background: viagem.status.toLowerCase().includes("aguardando")
                      ? "#fff0d4"
                      : "#e5f0ff",
                    color: viagem.status.toLowerCase().includes("aguardando")
                      ? "#a15c00"
                      : "#245ea8",
                    fontSize: 12,
                  }}
                >
                  {viagem.status}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Painel>
  );
}
