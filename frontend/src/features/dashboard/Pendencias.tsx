import { Painel, Vazio } from "../../features/dashboard/Painel";

export type SituacaoPendencia = "VENCIDO" | "PROXIMO_VENCIMENTO";

interface PendenciasData {
  motoristas: Array<{
    id: string | number;
    nome: string;
    vencimento: string;
    situacao: SituacaoPendencia;
  }>;
  documentos: Array<{
    id: string | number;
    tipo_documento: string;
    vencimento: string;
    placa: string;
    modelo: string;
    situacao: SituacaoPendencia;
  }>;
}

interface PendenciasProps {
  dados?: PendenciasData;
  demonstracao?: boolean;
}

const DEMO: PendenciasData = {
  motoristas: [
    {
      id: "m1",
      nome: "Ana Paula",
      vencimento: "2026-10-15",
      situacao: "VENCIDO",
    },
    {
      id: "m2",
      nome: "Carlos Henrique",
      vencimento: "2026-10-28",
      situacao: "PROXIMO_VENCIMENTO",
    },
  ],
  documentos: [
    {
      id: "d1",
      tipo_documento: "Licenciamento",
      vencimento: "2026-11-02",
      placa: "VF-03",
      modelo: "Van",
      situacao: "PROXIMO_VENCIMENTO",
    },
    {
      id: "d2",
      tipo_documento: "Seguro",
      vencimento: "2026-10-10",
      placa: "VF-05",
      modelo: "Ambulância",
      situacao: "VENCIDO",
    },
  ],
};

export function Pendencias({
  dados,
  demonstracao = false,
}: PendenciasProps) {
  const informacoes = dados ?? (demonstracao ? DEMO : undefined);

  const itens = informacoes
    ? [
        ...informacoes.motoristas.map((motorista) => ({
          id: `motorista-${motorista.id}`,
          titulo:
            motorista.situacao === "VENCIDO"
              ? "CNH vencida"
              : "CNH próxima do vencimento",
          detalhe: motorista.nome,
          situacao: motorista.situacao,
        })),
        ...informacoes.documentos.map((documento) => ({
          id: `documento-${documento.id}`,
          titulo:
            documento.situacao === "VENCIDO"
              ? "Documento de veículo vencido"
              : "Documento de veículo próximo do vencimento",
          detalhe: `${documento.placa} · ${documento.tipo_documento}`,
          situacao: documento.situacao,
        })),
      ]
    : [];

  return (
    <Painel
      titulo="Pendências"
      classe="painel-operacional--pendencias"
      demonstracao={demonstracao}
      linkTexto="Ver todas"
      linkHref="/pendencias"
    >
      {!informacoes || itens.length === 0 ? (
        <Vazio />
      ) : (
        <ul
          className="pendencias__lista"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {itens.map((item, indice) => {
            const vencido = item.situacao === "VENCIDO";
            const cor = vencido ? "#dc3039" : "#c27a00";
            const fundo = vencido ? "#fff0ef" : "#fff4d9";

            return (
              <li
                className="pendencias__item"
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px minmax(0, 1fr)",
                  alignItems: "start",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom:
                    indice < itens.length - 1
                      ? "1px solid #e1e6ed"
                      : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: fundo,
                    color: cor,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.75 3.75h6l4.5 4.5v11.5h-10.5v-16Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.75 3.95v4.5h4.3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12.95 11v3.2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="12.95" cy="16.4" r=".9" fill="currentColor" />
                  </svg>
                </span>

                <span style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: "block",
                      color: "#172033",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {item.titulo}
                  </strong>
                  <small
                    style={{
                      display: "block",
                      color: "#667085",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {item.detalhe}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Painel>
  );
}
