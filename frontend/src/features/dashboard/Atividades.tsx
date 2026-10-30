import { Painel, Vazio } from "../../features/dashboard/Painel";

interface AtividadeEvento {
  id: string | number;
  hora: string;
  descricao: string;
}

interface AtividadesData {
  eventos: AtividadeEvento[];
}

interface AtividadesProps {
  dados?: AtividadesData;
  demonstracao?: boolean;
}

const DEMO: AtividadesData = {
  eventos: [
    { id: "a1", hora: "09:42", descricao: "#TRP-1022 aprovado" },
    { id: "a2", hora: "09:20", descricao: "Motorista atribuído ao #TRP-1021" },
    { id: "a3", hora: "09:05", descricao: "Viagem #TRP-1018 concluída" },
    { id: "a4", hora: "08:45", descricao: "VF-04 colocado em manutenção" },
  ],
};

export function Atividades({
  dados,
  demonstracao = false,
}: AtividadesProps) {
  const informacoes = dados ?? (demonstracao ? DEMO : undefined);

  return (
    <Painel
      titulo="Atividade recente"
      classe="painel-operacional--atividade"
      demonstracao={demonstracao}
      linkTexto="Ver todas"
      linkHref="/atividades"
    >
      {!informacoes || informacoes.eventos.length === 0 ? (
        <Vazio />
      ) : (
        <ol
          className="atividade-recente__lista"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {informacoes.eventos.map((evento) => (
            <li
              className="atividade-recente__item"
              key={evento.id}
              style={{
                display: "grid",
                gridTemplateColumns: "46px 12px minmax(0, 1fr)",
                alignItems: "start",
                gap: 10,
                padding: "8px 0",
              }}
            >
              <time
                style={{
                  color: "#667085",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {evento.hora}
              </time>

              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#2d6bc5",
                  marginTop: 5,
                }}
              />

              <span style={{ color: "#172033", fontSize: 14 }}>
                {evento.descricao}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Painel>
  );
}