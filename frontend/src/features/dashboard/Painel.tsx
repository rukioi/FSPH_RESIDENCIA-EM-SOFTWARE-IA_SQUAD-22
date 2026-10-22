import type { ReactNode } from "react";

interface PainelProps {
  titulo: string;
  classe: string;
  children: ReactNode;
  linkTexto?: string;
  linkHref?: string;
  demonstracao?: boolean;
}

export function Painel({
  titulo,
  classe,
  children,
  linkTexto,
  linkHref,
}: PainelProps) {
  return (
    <section className={`painel-operacional ${classe}`}>
      <header className="painel-operacional__cabecalho">
        <h2>{titulo}</h2>

        {linkTexto && linkHref && (
          <a className="painel-operacional__link" href={linkHref}>
            {linkTexto} <span aria-hidden="true">→</span>
          </a>
        )}
      </header>

      <div className="painel-operacional__conteudo">{children}</div>
    </section>
  );
}

export function Vazio() {
  return (
    <p className="painel-operacional__vazio">
      Nenhum dado disponível.
    </p>
  );
}
