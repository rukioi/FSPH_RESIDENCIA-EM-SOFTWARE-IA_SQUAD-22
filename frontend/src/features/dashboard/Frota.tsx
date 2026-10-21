import { Painel, Vazio } from "../../features/dashboard/Painel";

interface FrotaData {
  disponiveis: number;
  emViagem: number;
  emManutencao: number;
  indisponiveis: number;
}

interface FrotaProps {
  dados?: FrotaData;
  demonstracao?: boolean;
}

const DEMO: FrotaData = {
  disponiveis: 3,
  emViagem: 2,
  emManutencao: 2,
  indisponiveis: 2,
};

const linhas: Array<{
  chave: keyof FrotaData;
  label: string;
  cor: string;
}> = [
  { chave: "disponiveis", label: "Disponíveis", cor: "#21864b" },
  { chave: "emViagem", label: "Em viagem", cor: "#2866c7" },
  { chave: "emManutencao", label: "Em manutenção", cor: "#c98200" },
  { chave: "indisponiveis", label: "Indisponíveis", cor: "#d52b36" },
];

export function Frota({ dados, demonstracao = false }: FrotaProps) {
  const informacoes = dados ?? (demonstracao ? DEMO : undefined);

  const total = informacoes
    ? Object.values(informacoes).reduce(
        (soma, quantidade) => soma + quantidade,
        0,
      )
    : 0;

  return (
    <Painel
      titulo="Situação da frota"
      classe="painel-operacional--frota"
      demonstracao={demonstracao}
      linkTexto="Ver veículos"
      linkHref="/veiculos"
    >
      {!informacoes ? (
        <Vazio />
      ) : (
        <div className="frota-resumo" style={{ display: "grid", gap: 14 }}>
          {linhas.map(({ chave, label, cor }) => {
            const quantidade = informacoes[chave];
            const percentual = total > 0 ? (quantidade / total) * 100 : 0;

            return (
              <div className="frota-resumo__linha" key={chave}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#667085", fontSize: 14 }}>
                    {label}
                  </span>
                  <strong style={{ color: "#101828", fontSize: 14 }}>
                    {quantidade}
                  </strong>
                </div>

                <div
                  aria-label={`${label}: ${quantidade} de ${total}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={quantidade}
                  style={{
                    height: 6,
                    borderRadius: 99,
                    background: "#edf1f5",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${percentual}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: cor,
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div
            style={{
              borderTop: "1px solid #e1e6ed",
              paddingTop: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span style={{ color: "#667085", fontSize: 14 }}>Total</span>
            <strong style={{ color: "#101828", fontSize: 14 }}>
              {total} veículos
            </strong>
          </div>
        </div>
      )}
    </Painel>
  );
}



