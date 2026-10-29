import { useEffect, useState } from 'react'

export function usePaginacao<T>(itens: T[], porPagina: number) {
  const [pagina, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina))
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])
  const atual = Math.min(pagina, totalPaginas)
  const inicio = (atual - 1) * porPagina
  return {
    pagina: atual,
    setPagina,
    totalPaginas,
    visiveis: itens.slice(inicio, inicio + porPagina),
    de: itens.length ? inicio + 1 : 0,
    ate: Math.min(inicio + porPagina, itens.length),
    total: itens.length,
  }
}

type Props = {
  pagina: number
  totalPaginas: number
  de: number
  ate: number
  total: number
  rotulo: string
  aoMudar: (p: number) => void
}

export function Paginacao({ pagina, totalPaginas, de, ate, total, rotulo, aoMudar }: Props) {
  return (
    <nav className="paginacao" aria-label={`Paginação de ${rotulo}`}>
      <span>
        Mostrando {de}–{ate} de {total} {rotulo}
      </span>
      <div className="paginacao__botoes">
        <button type="button" onClick={() => aoMudar(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
          ‹
        </button>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => aoMudar(n)}
            aria-current={n === pagina ? 'page' : undefined}
            aria-label={`Página ${n}`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => aoMudar(pagina + 1)}
          disabled={pagina === totalPaginas}
          aria-label="Próxima página"
        >
          ›
        </button>
      </div>
    </nav>
  )
}
