import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, navegar, useCaminho } from '../../app/routes/router'
import { ROTAS, lerDetalheSvo } from '../../app/routes/rotas'
import { sair } from '../../shared/services/auth.service'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import { PREVIEW_SVO, telaPreviewSvo } from '../../features/svo/preview'
import './SvoLayout.css'

type SvoLayoutProps = {
  children: ReactNode
  usuario?: UsuarioSessao
}

const icones = {
  transporte: 'M2 5h12v12H2z M14 9h4l4 5v3h-8 M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  dashboard: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  solicitacoes:
    'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 8h6 M9 12h6 M9 16h4',
  nova: 'M12 5v14 M5 12h14',
  ordens:
    'M8 4h8 M9 2h6v4H9z M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2z',
  notificacoes:
    'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10.3 21a2 2 0 0 0 3.4 0',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  sair: 'M10 17l5-5-5-5 M15 12H3 M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
}

type NomeIcone = keyof typeof icones

function Icone({
  nome,
  tamanho = 20,
}: {
  nome: NomeIcone
  tamanho?: number
}) {
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

function NotificacoesIndisponiveis() {
  return <span className="svo-menu__item svo-menu__item--indisponivel" aria-disabled="true">
    <Icone nome="notificacoes" />Notificações
  </span>
}

const itensMenu = [
  {
    nome: 'Dashboard SVO',
    icone: 'dashboard' as const,
    rota: ROTAS.svoDashboard,
    preview: PREVIEW_SVO.dashboard,
    habilitado: true,
  },
  {
    nome: 'Solicitações',
    icone: 'solicitacoes' as const,
    rota: ROTAS.svoSolicitacoes,
    preview: PREVIEW_SVO.solicitacoes,
    habilitado: true,
  },
  {
    nome: 'Nova Solicitação',
    icone: 'nova' as const,
    rota: ROTAS.svoNovaSolicitacao,
    preview: PREVIEW_SVO.nova,
    habilitado: true,
  },
  {
    nome: 'Ordens de Coleta',
    icone: 'ordens' as const,
    rota: ROTAS.svoOrdens,
    preview: PREVIEW_SVO.ordens,
    habilitado: true,
  },
  { nome: 'Minhas Ordens', icone: 'ordens' as const, rota: ROTAS.svoMinhasOrdens, preview: PREVIEW_SVO.equipe, habilitado: true },
]

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function tituloDaPagina(caminho: string): string {
  if (/^\/svo\/solicitacoes\/[1-9]\d*\/triagem$/.test(caminho)) return 'Triagem'
  if (caminho === ROTAS.svoNovaSolicitacao) return 'Nova Solicitação'
  if (caminho === ROTAS.svoSolicitacoes) return 'Solicitações'
  if (caminho === ROTAS.svoOrdens) return 'Ordens de Coleta'
  if (caminho === ROTAS.svoMinhasOrdens) return 'Minhas Ordens'
  return 'Dashboard SVO'
}

export function SvoLayout({
  children,
  usuario,
}: SvoLayoutProps) {
  const caminho = useCaminho()
  const [menuAberto, setMenuAberto] = useState(false)

  const [recolhido, setRecolhido] = useState(false)
  const botaoMenu = useRef<HTMLButtonElement>(null)
  const painelMenu = useRef<HTMLElement>(null)

  const conteudo = useRef<HTMLElement>(null)
  useEffect(() => {
    if (usuario) conteudo.current?.focus({preventScroll: true})
  }, [caminho, usuario])
  function fecharMenu() {
    setMenuAberto(false)
    requestAnimationFrame(() => botaoMenu.current?.focus())
  }

  useEffect(() => {
    if (!menuAberto) return
    painelMenu.current?.querySelector<HTMLAnchorElement>('nav a')?.focus()
    const desktop = window.matchMedia('(min-width: 901px)')
    const ajustar = () => { if (desktop.matches) setMenuAberto(false) }
    desktop.addEventListener('change', ajustar)
    return () => desktop.removeEventListener('change', ajustar)
  }, [menuAberto])

  const telaPreview = telaPreviewSvo(caminho)
  const modoPreview = telaPreview !== null
  const grupoPreview = telaPreview === 'triagem' ? 'solicitacoes'
    : telaPreview === 'detalhe' || telaPreview === 'despacho' ? 'ordens'
    : telaPreview === 'execucao' ? 'equipe' : telaPreview
  const equipe = usuario?.perfil === 'MOTORISTA'
  const detalhe = lerDetalheSvo(caminho)
  const perfilVisual = grupoPreview === 'equipe' || equipe ? 'Equipe de coleta' : 'Atendente SVO'
  const tituloDetalhe = detalhe && {triagem: 'Triagem', solicitacao: 'Detalhe da solicitação', ordem: 'Detalhe da ordem', execucao: 'Execução da ordem'}[detalhe.tela]
  const nome = usuario?.nome ?? usuario?.email ?? perfilVisual
  const caminhoVisual = grupoPreview
    ? itensMenu.find(item => item.preview === PREVIEW_SVO[grupoPreview])?.rota ?? caminho
    : caminho === ROTAS.svoRaiz ? ROTAS.svoDashboard
      : detalhe?.tela === 'execucao' ? ROTAS.svoMinhasOrdens : detalhe?.tela === 'ordem' ? ROTAS.svoOrdens
      : detalhe ? ROTAS.svoSolicitacoes : caminho

  return (
    <div
      data-preview={modoPreview || undefined}
      data-recolhido={recolhido || undefined}
      className={
        menuAberto
          ? 'svo-shell svo-shell--aberto'
          : 'svo-shell'
      }
    >
      <aside id="svo-menu" ref={painelMenu} className="svo-menu"
        onKeyDown={evento => {
          if (menuAberto && evento.key === 'Escape') fecharMenu()
        }}>
        {menuAberto && <button type="button" className="svo-menu__fechar" onClick={fecharMenu}>Fechar menu</button>}
        <div className="svo-menu__marca">
          {modoPreview && <span className="svo-marca-icone"><Icone nome="transporte"/></span>}
          <div>
            <strong>Gestão de Frotas</strong>
            <small>Central de Transporte</small>
          </div>
        </div>

        <nav
          className="svo-menu__nav"
          aria-label="Navegação SVO"
          onClick={(evento) => {
            if (evento.target instanceof Element && evento.target.closest('a') && menuAberto) fecharMenu()
          }}
        >
          {itensMenu.map((item) => {
            if (!modoPreview && (item.preview === PREVIEW_SVO.equipe) !== equipe) return null
            const ativo = caminhoVisual === item.rota
            const habilitado = modoPreview
              ? Boolean(item.preview)
              : item.habilitado

            if (!habilitado) {
              return (
                <span
                  key={item.nome}
                  className="svo-menu__item svo-menu__item--indisponivel"
                  aria-disabled="true"
                  title="Tela aguardando implementação"
                >
                  <Icone nome={item.icone} />
                  {item.nome}
                </span>
              )
            }

            return (
              <Fragment key={item.nome}>
                {modoPreview && item.preview === PREVIEW_SVO.dashboard && <span className="svo-menu__grupo">Atendimento SVO</span>}
                {modoPreview && item.preview === PREVIEW_SVO.equipe && <><NotificacoesIndisponiveis/><span className="svo-menu__grupo">Equipe</span></>}
              <Link
                para={modoPreview && item.preview ? item.preview : item.rota}
                ariaCurrent={ativo}
                className={
                  ativo
                    ? 'svo-menu__item svo-menu__item--ativo'
                    : 'svo-menu__item'
                }
              >
                <Icone nome={item.icone} />
                {item.nome}
              </Link>
              </Fragment>
            )
          })}

          {!modoPreview && !equipe && <NotificacoesIndisponiveis/>}
        </nav>

        <div className="svo-menu__rodape">
          <div className="svo-menu__usuario">
            <span className="svo-avatar">
              {iniciais(nome)}
            </span>

            <div>
              <strong>{nome}</strong>
              <small>{modoPreview ? 'Prévia de desenvolvimento' : perfilVisual}</small>
            </div>
          </div>

          {!modoPreview && (
            <button
              type="button"
              className="svo-menu__sair"
              onClick={() => {
                sair()
                navegar(ROTAS.login, true)
              }}
            >
              <Icone nome="sair" tamanho={18} />
              Sair
            </button>
          )}
        </div>
      </aside>

      <button
        type="button"
        className="svo-shell__fundo"
        aria-label="Fechar navegação"
        tabIndex={-1}
        onClick={fecharMenu}
      />

      <div className="svo-shell__principal" inert={menuAberto}>
        <header className="svo-cabecalho">
          <div className="svo-cabecalho__esquerda">
            <button
              type="button"
              ref={botaoMenu}
              className="svo-botao-icone"
              aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              aria-controls="svo-menu"
              aria-expanded={menuAberto}
              onClick={() =>
                setMenuAberto((aberto) => !aberto)
              }
            >
              <Icone nome="menu" />
            </button>

            {modoPreview && <button type="button" className="svo-toggle-desktop" aria-label="Alternar menu lateral"
              aria-controls="svo-menu" aria-expanded={!recolhido} onClick={() => setRecolhido(!recolhido)}>
              <Icone nome="menu" tamanho={18}/>
            </button>}
            <strong>{telaPreview === 'triagem' ? 'Triagem' : telaPreview === 'detalhe' ? 'Detalhe da ordem'
              : telaPreview === 'despacho' ? 'Preparar despacho' : telaPreview === 'execucao' ? 'Execução da ordem'
              : tituloDetalhe || tituloDaPagina(caminhoVisual)}</strong>
          </div>

          <div className="svo-cabecalho__direita">
            <span className="svo-avatar">
              {iniciais(nome)}
            </span>

            <div>
              <strong>{nome}</strong>
              <small>{modoPreview ? 'Prévia de desenvolvimento' : perfilVisual}</small>
            </div>
          </div>
        </header>

        <main ref={conteudo} tabIndex={-1} className="svo-conteudo">{children}</main>
      </div>
    </div>
  )
}
