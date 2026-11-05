import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Comentario } from './regras'
import './ComentariosCard.css'

type Props = {
  observacao: string
  comentariosIniciais: Comentario[]
  autor: { nome: string; cargo: string }
}

function agora() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Observação original do solicitante + comentários (adição apenas visual). */
export function ComentariosCard({ observacao, comentariosIniciais, autor }: Props) {
  const [comentarios, setComentarios] = useState<Comentario[]>(comentariosIniciais)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) {
      setErro('Digite um comentário antes de adicionar.')
      return
    }
    setComentarios((c) => [
      ...c,
      { id: `local-${Date.now()}`, autor: autor.nome, cargo: autor.cargo, data: agora(), texto: texto.trim() },
    ])
    setTexto('')
    setErro('')
  }

  return (
    <section className="cartao sol-cartao" aria-labelledby="comentarios-titulo">
      <div className="sol-cartao__topo">
        <h2 id="comentarios-titulo">Observações e comentários</h2>
      </div>
      <div className="sol-cartao__corpo comentarios">
        <div>
          <h3 className="comentarios__subtitulo">Observação da solicitação</h3>
          <p className={observacao ? 'comentarios__observacao' : 'comentarios__observacao comentarios__observacao--vazia'}>
            {observacao || 'O solicitante não informou observações.'}
          </p>
        </div>

        <div>
          <h3 className="comentarios__subtitulo">Comentários</h3>
          {comentarios.length === 0 ? (
            <p className="comentarios__vazio">Nenhum comentário registrado</p>
          ) : (
            <ul className="comentarios__lista">
              {comentarios.map((c) => (
                <li key={c.id} className="comentarios__item">
                  <div className="comentarios__autor">
                    <strong>{c.autor}</strong>
                    <small>
                      {c.cargo} · {c.data}
                    </small>
                  </div>
                  <p>{c.texto}</p>
                </li>
              ))}
            </ul>
          )}

          <form className="comentarios__form" onSubmit={adicionar} noValidate>
            <div className={erro ? 'campo campo--erro' : 'campo'}>
              <label htmlFor="novo-comentario">Novo comentário</label>
              <textarea
                id="novo-comentario"
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                  if (erro) setErro('')
                }}
                placeholder="Escreva um comentário sobre esta solicitação"
                aria-invalid={!!erro}
                aria-describedby={erro ? 'novo-comentario-erro' : undefined}
              />
              {erro && (
                <span id="novo-comentario-erro" className="campo__erro">
                  {erro}
                </span>
              )}
            </div>
            <button type="submit" className="btn btn--primario">
              Adicionar comentário
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
