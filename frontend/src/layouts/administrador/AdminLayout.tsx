import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { Icone } from '../../shared/components/Icone'
import type { NomeIcone } from '../../shared/components/Icone'
import { Link, navegar, useCaminho } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'
import { sair as encerrarSessao } from '../../shared/services/auth.service'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import './AdminLayout.css'

type ItemMenu = { nome: string; icone: NomeIcone; rota?: string }

// Itens sem `rota` ainda não têm página nesta etapa.
const itensMenu: ItemMenu[] = [
  { nome: 'Dashboard', icone: 'dashboard', rota: ROTAS.dashboard },
  { nome: 'Solicitações', icone: 'solicitacoes' },
  { nome: 'Calendário', icone: 'calendario' },
  { nome: 'Veículos', icone: 'veiculos' },
  { nome: 'Motoristas', icone: 'motoristas' },
  { nome: 'SVO', icone: 'svo' },
  { nome: 'Documentos', icone: 'documentos' },
  { nome: 'Abastecimentos', icone: 'abastecimentos' },
  { nome: 'Relatórios', icone: 'relatorios' },
  { nome: 'Auditoria', icone: 'auditoria', rota: ROTAS.auditoria },
  { nome: 'Notificações', icone: 'notificacoes' },
]
const itemConfiguracoes: ItemMenu = {
  nome: 'Configurações',
  icone: 'configuracoes',
  rota: ROTAS.configuracoes,
}

const totalNotificacoes = 3
const LIMITE_ARRASTE = 70

function iniciais(nome: string): string {
  return nome.split(' ').map((parte) => parte[0]).slice(0, 2).join('').toUpperCase()
}

function ItemDoMenu({ item, ativo, aoNavegar }: { item: ItemMenu; ativo: boolean; aoNavegar: () => void }) {
  if (!item.rota) {
    return (
      <span className="menu__item menu__item--inativo" aria-disabled="true">
        <Icone nome={item.icone} />
        {item.nome}
      </span>
    )
  }
  return (
    <span onClick={aoNavegar}>
      <Link
        para={item.rota}
        className={ativo ? 'menu__item menu__item--ativo' : 'menu__item'}
        ariaCurrent={ativo}
      >
        <Icone nome={item.icone} />
        {item.nome}
      </Link>
    </span>
  )
}

export function AdminLayout({ children, usuario: sessao }: { children: ReactNode; usuario: UsuarioSessao }) {
  const caminho = useCaminho()
  const nome = sessao.nome ?? sessao.email ?? 'Usuário'
  const usuario = {
    nome,
    cargo: sessao.perfil === 'ADM' ? 'Administrador' : 'Gestor da Frota',
    iniciais: iniciais(nome),
  }
  const [menuAberto, setMenuAberto] = useState(() => window.innerWidth > 900)
  const [deslocamento, setDeslocamento] = useState(0)
  const inicioArraste = useRef<number | null>(null)

  const todos = [...itensMenu, itemConfiguracoes]
  const itemAtivo = todos.find((i) => i.rota === caminho)?.nome ?? 'Dashboard'

  // Esc fecha a gaveta no celular
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.innerWidth <= 900) setMenuAberto(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  function fecharNoCelular() {
    if (window.innerWidth <= 900) setMenuAberto(false)
  }

  // Arrastar o menu para a esquerda o esconde
  function iniciar(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && (e.target as HTMLElement).closest('a')) return
    inicioArraste.current = e.clientX
  }
  function mover(e: PointerEvent<HTMLElement>) {
    if (inicioArraste.current === null) return
    setDeslocamento(Math.min(0, e.clientX - inicioArraste.current))
  }
  function soltar() {
    if (inicioArraste.current === null) return
    if (deslocamento < -LIMITE_ARRASTE) setMenuAberto(false)
    inicioArraste.current = null
    setDeslocamento(0)
  }

  function sair() {
    encerrarSessao()
    navegar(ROTAS.login)
  }

  return (
    <div className={menuAberto ? 'shell shell--aberto' : 'shell'}>
      <aside
        id="menu-lateral"
        className={deslocamento ? 'menu menu--arrastando' : 'menu'}
        style={deslocamento ? { transform: `translateX(${deslocamento}px)` } : undefined}
        aria-label="Menu principal"
        aria-hidden={!menuAberto}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerLeave={soltar}
      >
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
          <p className="menu__grupo">Administração</p>
          {itensMenu.map((item) => (
            <ItemDoMenu key={item.nome} item={item} ativo={item.nome === itemAtivo} aoNavegar={fecharNoCelular} />
          ))}
        </nav>

        <div className="menu__rodape">
          <ItemDoMenu
            item={itemConfiguracoes}
            ativo={itemAtivo === itemConfiguracoes.nome}
            aoNavegar={fecharNoCelular}
          />
        </div>

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
            aria-label={menuAberto ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={menuAberto}
            aria-controls="menu-lateral"
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

            <div className="cabecalho__usuario">
              <span className="avatar">{usuario.iniciais}</span>
              <span className="cabecalho__usuario-texto">
                <strong>{usuario.nome}</strong>
                <small>{usuario.cargo}</small>
              </span>
            </div>
            <button type="button" className="botao-icone" aria-label="Sair" title="Sair" onClick={sair}>
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
