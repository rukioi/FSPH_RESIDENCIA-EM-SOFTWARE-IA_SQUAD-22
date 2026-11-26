import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'

const EVENTO = 'rota:mudou'
const CHAVE_MODO = 'rota:modo-adm'

/** Telas do Gestor que o ADM também usa (primeiro trecho depois de /gestor/). */
const TELAS_COMPARTILHADAS = ['solicitacoes', 'calendario', 'veiculos', 'motoristas', 'abastecimentos', 'relatorios']

/** Telas do Gestor que, para o ADM, têm versão própria em /admin/. */
const TELAS_PROPRIAS_ADM: Record<string, string> = {
  '/gestor/dashboard': '/admin/dashboard',
  '/gestor/documentos': '/admin/documentos',
}

function trechoInicial(caminho: string, base: string): string | null {
  if (!caminho.startsWith(base + '/')) return null
  return caminho.slice(base.length + 1).split('/')[0] ?? null
}

function compartilhada(caminho: string, base: '/gestor' | '/admin') {
  const trecho = trechoInicial(caminho, base)
  return trecho !== null && TELAS_COMPARTILHADAS.includes(trecho)
}

function lerModoInicial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.location.pathname.startsWith('/admin/')) return true
    if (window.location.pathname.startsWith('/gestor/')) return false
    return window.sessionStorage.getItem(CHAVE_MODO) === '1'
  } catch {
    return window.location.pathname.startsWith('/admin/')
  }
}

let modoAdm = lerModoInicial()

/** Converte o endereço lógico (usado no código) no endereço exibido ao usuário. */
export function enderecoVisivel(caminho: string): string {
  if (!modoAdm) return caminho
  const [semQuery, ...resto] = caminho.split(/(?=[?#])/)
  const base = semQuery ?? caminho
  const proprio = TELAS_PROPRIAS_ADM[base]
  if (proprio) return proprio + resto.join('')
  if (compartilhada(base, '/gestor')) return '/admin' + base.slice('/gestor'.length) + resto.join('')
  return caminho
}

/** Converte o endereço exibido no endereço lógico que App e telas entendem. */
function caminhoLogico(caminho: string): string {
  if (modoAdm && compartilhada(caminho, '/admin')) return '/gestor' + caminho.slice('/admin'.length)
  return caminho
}

/** Corrige a URL visível quando ela não corresponde ao perfil atual. */
function sincronizarUrl() {
  const atual = window.location.pathname
  let correta = atual
  if (modoAdm) correta = enderecoVisivel(atual)
  // Fora do modo ADM, /admin/<tela compartilhada> volta para /gestor/ e passa pelo controle de acesso normal.
  if (!modoAdm && compartilhada(atual, '/admin')) correta = '/gestor' + atual.slice('/admin'.length)
  if (correta !== atual) {
    window.history.replaceState(window.history.state, '', correta + window.location.search + window.location.hash)
  }
}

function lerCaminho() {
  sincronizarUrl()
  return caminhoLogico(window.location.pathname)
}

/**
 * Informa ao roteador se a sessão atual é de Administrador.
 * Chamado pelo App assim que o perfil é confirmado.
 */
export function definirModoAdm(ativo: boolean) {
  try {
    if (ativo) window.sessionStorage.setItem(CHAVE_MODO, '1')
    else window.sessionStorage.removeItem(CHAVE_MODO)
  } catch {
    /* armazenamento indisponível: o modo vale apenas em memória */
  }
  if (modoAdm === ativo) return
  modoAdm = ativo
  sincronizarUrl()
  window.dispatchEvent(new Event(EVENTO))
}

export function navegar(caminho: string, substituir = false, estado: unknown = null) {
  const destino = enderecoVisivel(caminho)
  if (substituir) window.history.replaceState(estado, '', destino)
  else window.history.pushState(estado, '', destino)
  window.dispatchEvent(new Event(EVENTO))
}

export function useCaminho() {
  const [caminho, setCaminho] = useState(lerCaminho)
  useEffect(() => {
    const atualizar = () => setCaminho(lerCaminho())
    atualizar()
    window.addEventListener('popstate', atualizar)
    window.addEventListener(EVENTO, atualizar)
    return () => {
      window.removeEventListener('popstate', atualizar)
      window.removeEventListener(EVENTO, atualizar)
    }
  }, [])
  return caminho
}

// Links comuns (<a href="/gestor/...">) escritos direto nas telas também
// passam pelo roteador quando o ADM está logado, sem recarregar a página.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!modoAdm || e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const alvo = e.target instanceof Element ? e.target.closest('a[href]') : null
    if (!(alvo instanceof HTMLAnchorElement) || alvo.target === '_blank' || alvo.hasAttribute('download')) return
    const href = alvo.getAttribute('href') ?? ''
    if (!href.startsWith('/gestor/')) return
    e.preventDefault()
    navegar(href)
  })
}

type LinkProps = {
  para: string
  className?: string
  children: ReactNode
  ariaCurrent?: boolean
  title?: string
  ariaLabel?: string
  estado?: unknown
}

export function Link({ para, className, children, ariaCurrent, title, ariaLabel, estado }: LinkProps) {
  function aoClicar(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navegar(para, false, estado)
  }
  return (
    <a
      title={title}
      aria-label={ariaLabel}
      href={enderecoVisivel(para)}
      className={className}
      onClick={aoClicar}
      aria-current={ariaCurrent ? 'page' : undefined}
    >
      {children}
    </a>
  )
}
