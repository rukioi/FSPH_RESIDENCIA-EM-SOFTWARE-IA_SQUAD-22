import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { navegar, useCaminho } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'
import { sair } from '../../shared/services/auth.service'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import { Perfil } from '../../pages/gerente/Perfil'
import './GestorLayout.css'
import { IconeGestor as Icone, type NomeIcone } from '../../shared/components/IconeGestor'

// rota: tela já desenvolvida (os demais itens ainda não navegam)
const itensMenu: { nome: string; icone: NomeIcone; rota?: string }[] = [
  { nome: 'Dashboard', icone: 'dashboard', rota: ROTAS.dashboardGestor },
  { nome: 'Solicitações', icone: 'solicitacoes', rota: ROTAS.solicitacoesGestor },
  { nome: 'Calendário', icone: 'calendario', rota: ROTAS.calendarioGestor },
  { nome: 'Veículos', icone: 'veiculos', rota: ROTAS.veiculosGestor },
  { nome: 'Motoristas', icone: 'motoristas', rota: ROTAS.motoristasGestor },
  { nome: 'Documentos', icone: 'documentos' },
  { nome: 'Abastecimentos', icone: 'abastecimentos' },
  { nome: 'Relatórios', icone: 'relatorios' },
  { nome: 'Notificações', icone: 'notificacoes' },
]

const totalNotificacoes = 3

function iniciais(nome: string): string {
  return nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase()
}

/* ---------- Layout ---------- */
export function GestorLayout({ children, usuario: sessao }: { children: ReactNode; usuario: UsuarioSessao }) {
  const perfilRef = useRef<HTMLDialogElement>(null)
  const nome = sessao.nome ?? sessao.email ?? 'Usuário'
  const usuario = {
    nome,
    cargo: sessao.perfil === 'ADM' ? 'Administrador' : 'Gestor de Frota',
    iniciais: iniciais(nome),
  }
  // Menu aberto por padrão no computador e fechado no celular
  const [menuAberto, setMenuAberto] = useState(window.innerWidth > 900)
  // Item ativo segue a rota atual (inclusive detalhe/edição: /gestor/solicitacoes/...)
  const caminho = useCaminho()
  const [itemClicado, setItemClicado] = useState('Dashboard')
  const itemAtivo =
    itensMenu.find((item) => item.rota && (caminho === item.rota || caminho.startsWith(item.rota + '/')))?.nome ??
    itemClicado

  return (
    <div className={menuAberto ? 'shell shell--aberto' : 'shell'}>
      {/* ===== Menu lateral ===== */}
      <aside className="menu">
        <div className="menu__marca">
          <span className="menu__logo">
            <Icone nome="frota" tamanho={26} />
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
      className={
        item.nome === itemAtivo
          ? 'menu__item menu__item--ativo'
          : 'menu__item'
      }
      onClick={() => {
        setItemClicado(item.nome)
        if (item.rota) navegar(item.rota)
      }}
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

            <button type="button" className="cabecalho__usuario" aria-label="Meu perfil" onClick={() => perfilRef.current?.showModal()} disabled={!['ADM', 'GESTOR_FROTA'].includes(sessao.perfil)}>
              <span className="avatar">{usuario.iniciais}</span>
              <span className="cabecalho__usuario-texto">
                <strong>{usuario.nome}</strong>
                <small>{usuario.cargo}</small>
              </span>
              <Icone nome="seta" tamanho={16} />
            </button>
            <button
              type="button"
              className="botao-icone"
              aria-label="Sair"
              title="Sair"
              onClick={() => {
                sair()
                navegar(ROTAS.login, true)
              }}
            >
              <Icone nome="sair" />
            </button>
          </div>
        </header>

        <div className="faixa" />

        <main className="conteudo">{children}</main>
      </div>
      <dialog ref={perfilRef} className="perfil-modal" aria-labelledby="perfil-titulo">
        <Perfil usuario={sessao} />
        <button type="button" className="perfil-modal__fechar" onClick={() => perfilRef.current?.close()}>Fechar</button>
      </dialog>
    </div>
  )
}
