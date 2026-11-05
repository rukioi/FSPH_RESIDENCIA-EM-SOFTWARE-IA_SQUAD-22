import { useMemo, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { Paginacao, usePaginacao } from '../../shared/components/Paginacao'
import { listarSolicitacoes } from '../../features/solicitacoes/dados'
import { STATUS, formatarData, podeAnalisar, podeEditar } from '../../features/solicitacoes/regras'
import type { StatusSolicitacao as Status } from '../../features/solicitacoes/regras'
import { StatusSolicitacao } from '../../features/solicitacoes/StatusSolicitacao'
import '../../features/solicitacoes/solicitacoes.css'

const BASE = ROTAS.solicitacoesGestor

export function Solicitacoes() {
  // Status local para aprovar/recusar direto da lista (somente visual).
  const [alterados, setAlterados] = useState<Record<string, Status>>({})
  const [busca, setBusca] = useState('')
  const [data, setData] = useState('')
  const [status, setStatus] = useState('')
  const [aviso, setAviso] = useState('')

  const todas = useMemo(
    () => listarSolicitacoes().map((s) => ({ ...s, status: alterados[s.id] ?? s.status })),
    [alterados],
  )
  const filtradas = todas.filter((s) => {
    const termo = busca.trim().toLowerCase().replace('#', '')
    const casa =
      !termo ||
      [s.id, s.solicitante, s.instituicao, s.origem, s.destino].some((c) => c.toLowerCase().includes(termo))
    return casa && (!data || s.data === data) && (!status || s.status === status)
  })
  const pag = usePaginacao(filtradas, 8)

  function analisar(id: string, novo: Status) {
    setAlterados((a) => ({ ...a, [id]: novo }))
    setAviso(`#${id} ${novo === 'Aprovada' ? 'aprovada' : 'recusada'} (demonstração — nada foi salvo).`)
  }

  return (
    <>
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Solicitações</h1>
          <p className="pagina__descricao">Analise, aprove e acompanhe todo o ciclo das solicitações de transporte.</p>
        </div>
      </div>

      {aviso && (
        <p className="sol-aviso" role="status">
          <Icone nome="check" tamanho={18} /> {aviso}
        </p>
      )}

      <section className="cartao">
        <div className="sol-filtros">
          <div className="campo sol-busca">
            <label htmlFor="g-busca">Buscar</label>
            <Icone nome="busca" tamanho={18} />
            <input
              id="g-busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Protocolo, solicitante ou local"
            />
          </div>
          <div className="campo">
            <label htmlFor="g-data">Data</label>
            <input id="g-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="g-status">Status</label>
            <select id="g-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </div>
          <p className="sol-total" style={{ padding: 0, alignSelf: 'center' }}>
            {filtradas.length} de {todas.length} solicitações
          </p>
          <span />
        </div>

        {filtradas.length === 0 ? (
          <div className="vazio">
            <strong>Nenhuma solicitação encontrada</strong>
            <p>Ajuste a busca ou os filtros.</p>
          </div>
        ) : (
          <>
            <div className="sol-tabela-wrap">
              <table className="sol-tabela">
                <thead>
                  <tr>
                    <th>Protocolo</th>
                    <th>Data/hora</th>
                    <th>Solicitante</th>
                    <th>Instituição</th>
                    <th>Destino</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pag.visiveis.map((s) => (
                    <tr key={s.id}>
                      <td className="sol-tabela__ticket">#{s.id}</td>
                      <td>
                        {formatarData(s.data)} · {s.horario}
                      </td>
                      <td>{s.solicitante}</td>
                      <td>{s.instituicao}</td>
                      <td>{s.destino}</td>
                      <td>
                        <StatusSolicitacao status={s.status} />
                      </td>
                      <td>
                        <div className="sol-acoes">
                          <button
                            type="button"
                            className="sol-acao"
                            aria-label={`Ver detalhes de #${s.id}`}
                            title="Ver detalhes"
                            onClick={() => navegar(rotaSolicitacao(BASE, s.id))}
                          >
                            <Icone nome="olho" tamanho={18} />
                          </button>
                          {podeAnalisar('gestor', s.status) && (
                            <>
                              <button
                                type="button"
                                className="sol-acao sol-acao--aprovar"
                                aria-label={`Aprovar #${s.id}`}
                                title="Aprovar"
                                onClick={() => analisar(s.id, 'Aprovada')}
                              >
                                <Icone nome="check" tamanho={18} />
                              </button>
                              <button
                                type="button"
                                className="sol-acao sol-acao--recusar"
                                aria-label={`Recusar #${s.id}`}
                                title="Recusar"
                                onClick={() => analisar(s.id, 'Recusada')}
                              >
                                <Icone nome="fechar" tamanho={18} />
                              </button>
                            </>
                          )}
                          {podeEditar('gestor', s.status) && (
                            <button
                              type="button"
                              className="sol-acao"
                              aria-label={`Editar #${s.id}`}
                              title="Editar"
                              onClick={() => navegar(rotaSolicitacao(BASE, s.id, true))}
                            >
                              <Icone nome="editar" tamanho={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao {...pag} rotulo="solicitações" aoMudar={pag.setPagina} />
          </>
        )}
      </section>
    </>
  )
}
