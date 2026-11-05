import { useState } from 'react'
import { navegar } from '../../app/routes/router'
import { rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { buscarSolicitacao } from './dados'
import { paraFormulario, podeEditar } from './regras'
import type { PerfilTela } from './regras'
import { SolicitacaoForm } from './SolicitacaoForm'
import './solicitacoes.css'

type Props = { id: string; perfil: PerfilTela; base: string }

/** Edição compartilhada (Gestor e Solicitante) — reutiliza o formulário da Nova Solicitação. */
export function EditarSolicitacao({ id, perfil, base }: Props) {
  const s = buscarSolicitacao(id)
  const [salvo, setSalvo] = useState(false)
  const rotaDetalhe = rotaSolicitacao(base, id)

  if (!s) {
    return (
      <div className="cartao vazio">
        <strong>Solicitação não encontrada</strong>
        <p>O chamado #{id} não existe ou foi removido.</p>
      </div>
    )
  }

  const permitido = podeEditar(perfil, s.status)

  return (
    <>
      <button type="button" className="sol-voltar" onClick={() => navegar(rotaDetalhe)}>
        <Icone nome="seta" tamanho={18} /> Chamado #{s.id}
      </button>

      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Editar chamado</h1>
          <p className="pagina__descricao">Altere somente os dados pertinentes à solicitação.</p>
        </div>
      </div>

      {!permitido ? (
        <p className="sol-aviso sol-aviso--erro" role="alert">
          Solicitações com status “{s.status}” não podem ser editadas.
        </p>
      ) : (
        <>
          {salvo && (
            <p className="sol-aviso" role="status">
              <Icone nome="check" tamanho={18} /> Alterações conferidas (demonstração — nada foi salvo).
            </p>
          )}
          <SolicitacaoForm
            modo="editar"
            ticket={s.id}
            valoresIniciais={paraFormulario(s)}
            rotuloEnviar="Salvar alterações"
            aoCancelar={() => navegar(rotaDetalhe)}
            aoEnviar={() => {
              setSalvo(true)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </>
  )
}
