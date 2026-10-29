// Roteador mínimo baseado na History API (sem dependências).
import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'

const EVENTO = 'rota:mudou'

export function navegar(caminho: string, substituir = false) {
  if (substituir) window.history.replaceState(null, '', caminho)
  else window.history.pushState(null, '', caminho)
  window.dispatchEvent(new Event(EVENTO))
}

export function useCaminho() {
  const [caminho, setCaminho] = useState(window.location.pathname)
  useEffect(() => {
    const atualizar = () => setCaminho(window.location.pathname)
    window.addEventListener('popstate', atualizar)
    window.addEventListener(EVENTO, atualizar)
    return () => {
      window.removeEventListener('popstate', atualizar)
      window.removeEventListener(EVENTO, atualizar)
    }
  }, [])
  return caminho
}

type LinkProps = {
  para: string
  className?: string
  children: ReactNode
  ariaCurrent?: boolean
}

export function Link({ para, className, children, ariaCurrent }: LinkProps) {
  function aoClicar(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navegar(para)
  }
  return (
    <a
      href={para}
      className={className}
      onClick={aoClicar}
      aria-current={ariaCurrent ? 'page' : undefined}
    >
      {children}
    </a>
  )
}
