import { Sininho } from '../../features/notificacoes/Sininho'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { navegar, useCaminho } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import type { NomeIcone } from '../../shared/components/Icone'
import { sair } from '../../shared/services/auth.service'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import '../gestor/GestorLayout.css'

const itensMenu: { nome: string; icone: NomeIcone; rota?: string }[] = [
  { nome: 'Nova Solicitação', icone: 'mais', rota: ROTAS.novaSolicitacao },
  { nome: 'Minhas Solicitações', icone: 'solicitacoes', rota: ROTAS.minhasSolicitacoes },
  { nome: 'Notificações', icone: 'notificacoes', rota: ROTAS.notificacoes },
]


function iniciais(nome: string): string {
  return nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase()
}

export function SolicitanteLayout({ children, usuario: sessao }: { children: ReactNode; usuario: UsuarioSessao }) {
  const nome = sessao.nome ?? sessao.email ?? 'Usuário'
  const usuario = { nome, cargo: 'Solicitante', iniciais: iniciais(nome) }
  const [menuAberto, setMenuAberto] = useState(window.innerWidth > 900)
  const caminho = useCaminho()
  const [itemClicado, setItemClicado] = useState('Minhas Solicitações')
  const itemAtivo =
    itensMenu.find((item) => item.rota && (caminho === item.rota || caminho.startsWith(item.rota + '/')))?.nome ??
    itemClicado

  return (
    <div className={menuAberto ? 'shell shell--aberto' : 'shell'}>
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
          <p className="menu__grupo">Solicitações</p>
          {itensMenu.map((item) => (
            <button
              key={item.nome}
              type="button"
              className={item.nome === itemAtivo ? 'menu__item menu__item--ativo' : 'menu__item'}
              aria-current={item.nome === itemAtivo ? 'page' : undefined}
              onClick={() => {
                setItemClicado(item.nome)
                if (item.rota) navegar(item.rota)
                if (window.innerWidth <= 900) setMenuAberto(false)
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
            <Sininho />

            <button type="button" className="cabecalho__usuario">
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
    </div>
  )
}
