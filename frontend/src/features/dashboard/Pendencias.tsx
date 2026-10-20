import { useState } from 'react';
import "../../app/Pendencias.css";

type Pendencia = {
  id: number;
  titulo: string;
  referencia: string;
  status: 'vencida' | 'proxima';
};

const pendencias: Pendencia[] = [
  { id: 1, titulo: 'CNH vencida', referencia: 'Ana Paula', status: 'vencida' },
  { id: 2, titulo: 'CNH próximo do vencimento', referencia: 'Carlos Henrique', status: 'proxima' },
  { id: 3, titulo: 'Documento de veículo próximo do vencimento', referencia: 'VF-03', status: 'proxima' },
  { id: 4, titulo: 'Documento de veículo vencido', referencia: 'VF-05', status: 'vencida' },
];

const filtros = [
  { valor: 'todas', titulo: 'Todas' },
  { valor: 'vencida', titulo: 'Vencidas' },
  { valor: 'proxima', titulo: 'A vencer' },
] as const;

function IconeDocumento() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 11v4" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function Lista({ itens }: { itens: Pendencia[] }) {
  return (
    <ul className="pendencias-lista">
      {itens.map(item => (
        <li className="pendencia-item" key={item.id}>
          <span className={`documento-icone documento-${item.status}`}>
            <IconeDocumento />
          </span>
          <div className="pendencia-texto">
            <p>{item.titulo}</p>
            <span>{item.referencia}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Pendencias() {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<string>('todas');
  const itens = pendencias.filter(item => filtro === 'todas' || item.status === filtro);

  return (
    <>
      <section className="painel pendencias-painel" aria-labelledby="pendencias-titulo">
        <header className="painel-cabecalho">
          <h2 id="pendencias-titulo">{"Pendências"}</h2>
          <button type="button" className="botao-link" onClick={() => setAberto(true)}>
            {"Ver todas "}
            <IconeSeta />
          </button>
        </header>
        <Lista itens={pendencias} />
      </section>
      
      {aberto && (
        <div className="modal-fundo" onClick={() => setAberto(false)}>
          <section
            className="pendencias-modal painel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-titulo"
            onClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Escape') setAberto(false); }}
          >
            <header className="painel-cabecalho">
              <h2 id="modal-titulo">{"Todas as pendências"}</h2>
              <button type="button" className="botao-fechar" aria-label="Fechar pendências" autoFocus onClick={() => setAberto(false)}>
                <IconeFechar />
              </button>
            </header>
            <div className="filtros" aria-label="Filtrar pendências">
              {filtros.map(opcao => (
                <button
                  type="button"
                  key={opcao.valor}
                  className={filtro === opcao.valor ? 'botao-filtro filtro-ativo' : 'botao-filtro'}
                  aria-pressed={filtro === opcao.valor}
                  onClick={() => setFiltro(opcao.valor)}
                >
                  {opcao.titulo}
                </button>
              ))}
            </div>
            <Lista itens={itens} />
          </section>
        </div>
      )}
    </>
  );
}
