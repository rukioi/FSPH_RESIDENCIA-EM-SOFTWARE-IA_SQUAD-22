import type { ReactNode } from "react";

interface PainelProps {
  titulo: string;
  classe: string;
  children: ReactNode;
  linkTexto?: string;
  linkHref?: string;
  demonstracao?: boolean;
}

/** Identifica demonstração junto do título sem confundir fixtures com dados persistidos. */
export function Painel({
  titulo,
  classe,
  children,
  linkTexto,
  linkHref,
  demonstracao,
}: PainelProps) {
  return (
    <section className={`painel-operacional ${classe}`}>
      <header className="painel-operacional__cabecalho">
        <div>
          <h2>{titulo}</h2>
          {demonstracao && <small>Demonstração</small>}
        </div>

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
