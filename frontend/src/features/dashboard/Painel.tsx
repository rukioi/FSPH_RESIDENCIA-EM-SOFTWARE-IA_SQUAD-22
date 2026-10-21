import type { ReactNode } from "react";

export function Painel({
  titulo,
  classe,
  children,
}: {
  titulo: string;
  classe: string;
  children: ReactNode;
}) {
  return (
    <section className={`painel-operacional ${classe}`}>
      <header className="painel-operacional__cabecalho">
        <h2>{titulo}</h2>
      </header>
      <div className="painel-operacional__conteudo">{children}</div>
    </section>
  );
}

export function Vazio() {
  return <p className="painel-operacional__vazio">Nenhum dado disponível.</p>;
}

