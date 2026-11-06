import type { ReactNode } from 'react'

export function Pagina({ titulo, descricao, acao, children }: {
  titulo: string; descricao?: string; acao?: ReactNode; children: ReactNode
}) {
  return <div className="svo-pagina">
    <header className="svo-titulo"><div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>{acao}</header>
    {children}
  </div>
}

export function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="svo-painel"><h2>{titulo}</h2><div className="svo-painel__corpo">{children}</div></section>
}

/** Reserva os campos de leitura sem atribuir valores a uma solicitação ou ordem. */
export function Campos({ nomes }: { nomes: string[] }) {
  return <div className="svo-dados-pendentes">
    <p>Consulta indisponível para esta seção.</p>
    <ul aria-label="Campos da consulta">{nomes.map(nome => <li key={nome}>{nome}</li>)}</ul>
  </div>
}

export function Atalho({ href, children, primario = false }: {
  href: string; children: ReactNode; primario?: boolean
}) {
  return <a className={'svo-atalho' + (primario ? ' svo-atalho--primario' : '')} href={href}>{children}</a>
}

/** A variante de apresentação é explícita na URL e nunca representa resposta do servidor. */
export function varianteVisual() {
  return new URLSearchParams(window.location.search).get('estado')
}
