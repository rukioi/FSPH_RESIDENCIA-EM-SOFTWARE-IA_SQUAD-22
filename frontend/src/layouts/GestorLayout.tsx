import { useState } from 'react'
import type { ReactNode } from 'react'
import './GestorLayout.css'

const icones = {
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  solicitacoes:
    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 3h6v4H9z M9 12h6 M9 16h6',
  calendario:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 2v4 M8 2v4 M3 10h18',
  veiculos: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12H4z M4 12h16 M7 21v-3 M17 21v-3',
  motoristas:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  documentos: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  abastecimentos:
    'M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17 M3 22h12 M15 11h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3 M6 8h6',
  relatorios: 'M3 3v18h18 M8 17v-5 M13 17V8 M18 17v-8',
  notificacoes: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10.3 21a2 2 0 0 0 3.4 0',
  menu: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 3v18',
  seta: 'm6 9 6 6 6-6',
}

type NomeIcone = keyof typeof icones

function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icones[nome]} />
    </svg>
  )
}

const itensMenu: { nome: string; icone: NomeIcone }[] = [
  { nome: 'Dashboard', icone: 'dashboard' },
  { nome: 'Solicitações', icone: 'solicitacoes' },
  { nome: 'Calendário', icone: 'calendario' },
  { nome: 'Veículos', icone: 'veiculos' },
  { nome: 'Motoristas', icone: 'motoristas' },
  { nome: 'Documentos', icone: 'documentos' },
  { nome: 'Abastecimentos', icone: 'abastecimentos' },
  { nome: 'Relatórios', icone: 'relatorios' },
  { nome: 'Notificações', icone: 'notificacoes' },
]

const usuario = { nome: 'Carlos Almeida', cargo: 'Gestor de Frota', iniciais: 'CA' }
const totalNotificacoes = 3

/* ---------- Layout ---------- */
export function GestorLayout({ children }: { children: ReactNode }) {
  // Menu aberto por padrão no computador e fechado no celular
  const [menuAberto, setMenuAberto] = useState(window.innerWidth > 900)
  const [itemAtivo, setItemAtivo] = useState('Dashboard')

  return (
    <div className={menuAberto ? 'shell shell--aberto' : 'shell'}>
      {/* ===== Menu lateral ===== */}
      <aside className="menu">
        <div className="menu__marca">
          <span className="menu__logo">
            <Icone nome="veiculos" tamanho={22} />
          </span>
          <div>
            <strong>Gestão de Frotas</strong>
            <small>Central de Transporte</small>
          </div>
        </div>

        <nav className="menu__nav">
          <p className="menu__grupo">Operação</p>
          {itensMenu.map((item) => (
            <button
              key={item.nome}
              type="button"
              className={item.nome === itemAtivo ? 'menu__item menu__item--ativo' : 'menu__item'}
              onClick={() => setItemAtivo(item.nome)}
            >
              <Icone nome={item.icone} />
              {item.nome}
            </button>
          ))}
        </nav>

        <div className="menu__usuario">
          <span className="avatar">{usuario.iniciais}</span>
          <div>
            <strong>{usuario.nome}</strong>
            <small>{usuario.cargo}</small>
          </div>
        </div>
      </aside>

      <div className="shell__fundo" onClick={() => setMenuAberto(false)} />

      {/* ===== Cabeçalho + conteúdo ===== */}
      <div className="shell__principal">
        <header className="cabecalho">
          <button
            type="button"
            className="botao-icone"
            aria-label="Abrir ou fechar menu"
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <Icone nome="menu" />
          </button>

          <p className="cabecalho__caminho">
            Gestão de Frotas / <strong>{itemAtivo}</strong>
          </p>

          <div className="cabecalho__direita">
            <button
              type="button"
              className="botao-icone"
              aria-label={`Notificações: ${totalNotificacoes} não lidas`}
            >
              <Icone nome="notificacoes" />
              <span className="selo">{totalNotificacoes}</span>
            </button>

            <button type="button" className="cabecalho__usuario">
              <span className="avatar">{usuario.iniciais}</span>
              <span className="cabecalho__usuario-texto">
                <strong>{usuario.nome}</strong>
                <small>{usuario.cargo}</small>
              </span>
              <Icone nome="seta" tamanho={16} />
            </button>
          </div>
        </header>

        <div className="faixa" />

        <main className="conteudo">{children}</main>
      </div>
    </div>
  )
}