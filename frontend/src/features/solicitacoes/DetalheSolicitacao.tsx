import { useState } from 'react'
import type { ReactNode } from 'react'
import { navegar } from '../../app/routes/router'
import { rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { buscarSolicitacao } from './dados'
import { formatarData, podeAnalisar, podeCancelar, podeEditar } from './regras'
import type { PerfilTela, StatusSolicitacao as Status } from './regras'
import { StatusSolicitacao } from './StatusSolicitacao'
import { TimelineAcompanhamento } from './TimelineAcompanhamento'
import { ComentariosCard } from './ComentariosCard'
import { CancelarSolicitacaoModal } from './CancelarSolicitacaoModal'
import './solicitacoes.css'
import './DetalheSolicitacao.css'

type Props = {
  id: string
  perfil: PerfilTela
  /** Rota da listagem (voltar) e base para montar a rota de edição. */
  base: string
  rotuloVoltar: string
  autor: { nome: string; cargo: string }
}

/** Tela de detalhamento compartilhada por Gestor e Solicitante. */
export function DetalheSolicitacao({ id, perfil, base, rotuloVoltar, autor }: Props) {
  const original = buscarSolicitacao(id)
  // Status local: muda apenas na tela (demonstração), nada é salvo.
  const [status, setStatus] = useState<Status | undefined>(original?.status)
  const [aviso, setAviso] = useState('')
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false)

  if (!original || !status) {
    return (
      <div className="cartao vazio">
        <strong>Solicitação não encontrada</strong>
        <p>O chamado #{id} não existe ou foi removido.</p>
        <button type="button" className="btn btn--secundario" style={{ marginTop: 16 }} onClick={() => navegar(base)}>
          {rotuloVoltar}
        </button>
      </div>
    )
  }

  const s = { ...original, status }

  function mudarStatus(novo: Status, mensagem: string) {
    setStatus(novo)
    setAviso(mensagem)
  }

  const info: [string, ReactNode][] = [
    ['Número do chamado', `#${s.id}`],
    ['Solicitante', s.solicitante],
    ['Instituição', s.instituicao],
    ['Data', formatarData(s.data)],
    ['Horário', s.horario],
    ['Origem', s.origem],
    ['Destino', s.destino],
    ['Passageiros', `${s.passageiros} ${s.passageiros === 1 ? 'passageiro' : 'passageiros'}`],
    ['Finalidade', s.finalidade],
    ['Documentos/objetos', s.documentos || 'Nenhum informado'],
    ['Status', <StatusSolicitacao key="st" status={s.status} />],
    ['Data de criação', s.criadaEm],
  ]

  const mostrarAcoes = podeEditar(perfil, s.status) || podeCancelar(perfil, s.status) || podeAnalisar(perfil, s.status)

  return (
    <>
      <button type="button" className="sol-voltar" onClick={() => navegar(base)}>
        <Icone nome="seta" tamanho={18} /> {rotuloVoltar}
      </button>

      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Chamado #{s.id}</h1>
          <p className="pagina__descricao">Detalhes, andamento e comentários da solicitação.</p>
        </div>
      </div>

      {aviso && (
        <p className="sol-aviso" role="status">
          <Icone nome="check" tamanho={18} /> {aviso}
        </p>
      )}

      <section className="cartao sol-cartao" aria-labelledby="info-titulo">
        <div className="sol-cartao__topo">
          <h2 id="info-titulo">Informações da solicitação</h2>
        </div>
        <div className="sol-cartao__corpo">
          <dl className="detalhe__info sol-grade sol-grade--3">
            {info.map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>

          {mostrarAcoes && (
            <div className="detalhe__acoes">
              <span>Ações</span>
              {podeAnalisar(perfil, s.status) && (
                <>
                  <button
                    type="button"
                    className="btn btn--secundario detalhe__aprovar"
                    onClick={() => mudarStatus('Aprovada', 'Solicitação aprovada (demonstração — nada foi salvo).')}
                  >
                    <Icone nome="check" tamanho={18} /> Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn btn--secundario detalhe__recusar"
                    onClick={() => mudarStatus('Recusada', 'Solicitação recusada (demonstração — nada foi salvo).')}
                  >
                    <Icone nome="fechar" tamanho={18} /> Recusar
                  </button>
                </>
              )}
              {podeEditar(perfil, s.status) && (
                <button type="button" className="btn btn--secundario" onClick={() => navegar(rotaSolicitacao(base, s.id, true))}>
                  <Icone nome="editar" tamanho={18} /> Editar
                </button>
              )}
              {podeCancelar(perfil, s.status) && (
                <button type="button" className="btn btn--secundario detalhe__recusar" onClick={() => setConfirmarCancelamento(true)}>
                  Cancelar solicitação
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <TimelineAcompanhamento solicitacao={s} />

      <ComentariosCard observacao={s.observacao} comentariosIniciais={s.comentarios} autor={autor} />

      {confirmarCancelamento && (
        <CancelarSolicitacaoModal
          ticket={s.id}
          aoVoltar={() => setConfirmarCancelamento(false)}
          aoConfirmar={() => {
            setConfirmarCancelamento(false)
            mudarStatus('Cancelada', `Solicitação #${s.id} cancelada (demonstração — nada foi salvo).`)
          }}
        />
      )}
    </>
  )
}
