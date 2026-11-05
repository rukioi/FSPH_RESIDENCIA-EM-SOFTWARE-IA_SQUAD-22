import { useEffect, useRef } from 'react'
import './CancelarSolicitacaoModal.css'

type Props = {
  ticket: string
  aoVoltar: () => void
  aoConfirmar: () => void
}

export function CancelarSolicitacaoModal({ ticket, aoVoltar, aoConfirmar }: Props) {
  const voltarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    voltarRef.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoVoltar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoVoltar])

  return (
    <div className="modal-cancelar__fundo" onClick={aoVoltar}>
      <div
        className="modal-cancelar cartao"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancelar-titulo"
        aria-describedby="cancelar-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cancelar-titulo">Cancelar solicitação?</h2>
        <p id="cancelar-texto">
          Você está prestes a cancelar a solicitação <strong>#{ticket}</strong>. Depois de cancelada, ela não poderá
          ser editada nem seguirá para agendamento.
        </p>
        <div className="modal-cancelar__acoes">
          <button ref={voltarRef} type="button" className="btn btn--secundario" onClick={aoVoltar}>
            Voltar
          </button>
          <button type="button" className="btn btn--perigo" onClick={aoConfirmar}>
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  )
}
