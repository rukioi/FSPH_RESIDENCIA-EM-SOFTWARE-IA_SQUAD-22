import { DatePicker } from '../../shared/components/DatePicker';
import { Select } from '../../shared/components/Select';

import { useEffect, useMemo, useRef, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas'
import { IconeGestor as Icone } from '../../shared/components/IconeGestor'
import { Paginacao, usePaginacao } from '../../shared/components/Paginacao'
import {
  listarSolicitacoes,
  aprovarSolicitacao,
  rejeitarSolicitacao,
} from '../../shared/services/solicitacoes.service'
import { STATUS, formatarData } from '../../features/solicitacoes/regras'
import type { StatusSolicitacao as Status } from '../../features/solicitacoes/regras'
import { StatusSolicitacao } from '../../features/solicitacoes/StatusSolicitacao'
import '../../features/solicitacoes/solicitacoes.css'

const BASE = ROTAS.solicitacoesGestor

type SolicitacaoGestor = {
  id: string
  codigo: string
  solicitante: string
  instituicao: string
  data: string
  horario: string
  origem: string
  destino: string
  status: Status
}

function converterStatus(status: string | null): Status {
  switch (status) {
    case 'PENDENTE':
      return 'Pendente'
    case 'APROVADA':
      return 'Aprovada'
    case 'REPROVADA':
      return 'Recusada'
    case 'AGENDADA':
    case 'PRONTA_PARA_INICIAR':
      return 'Agendada'
    case 'EM_ANDAMENTO':
      return 'Em andamento'
    case 'CONCLUIDA':
      return 'Concluída'
    default:
      return 'Não informado'
  }
}

function converterDataHora(dataHora: string) {
  return { data: dataHora.slice(0, 10), horario: dataHora.slice(11, 16) }
}

export function Solicitacoes() {
  const [lista, setLista] = useState<SolicitacaoGestor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [processandoId, setProcessandoId] = useState('')
  const [busca, setBusca] = useState('')
  const [data, setData] = useState('')
  const [status, setStatus] = useState('')
  const [aviso, setAviso] = useState('')
  const [atualizacao, setAtualizacao] = useState(0)
  const geracao = useRef(0)

  // Busca todas as páginas disponibilizadas pelo backend.
  useEffect(() => {
    let ativo = true
    const consulta = ++geracao.current

    async function carregar() {
      try {
        setCarregando(true)
        setErro('')

        const primeiraPagina = await listarSolicitacoes({
          page: 1,
          limit: 100,
        })

        const resultados = [...primeiraPagina.data]

        const totalPaginas = Math.ceil(
          primeiraPagina.meta.total / primeiraPagina.meta.limit,
        )

        for (let pagina = 2; pagina <= totalPaginas; pagina++) {
          const resposta = await listarSolicitacoes({
            page: pagina,
            limit: 100,
          })

          resultados.push(...resposta.data)
        }

        const convertidas: SolicitacaoGestor[] = resultados.map((item) => {
          const { data, horario } = converterDataHora(item.dataHoraSaida)

          return {
            id: String(item.id),
            codigo: (item.codigoExibicao || item.codigo).replace(/^#/, ''),
            solicitante: item.solicitante?.nome ?? 'Não informado',
            instituicao: '—',
            data,
            horario,
            origem: item.origem,
            destino: item.destino,
            status: converterStatus(item.status),
          }
        })

        if (ativo && consulta === geracao.current) {
          setLista(convertidas)
        }
      } catch (erroApi) {
        if (ativo && consulta === geracao.current) {
          setErro(
            erroApi instanceof Error
              ? erroApi.message
              : 'Não foi possível carregar as solicitações.',
          )
        }
      } finally {
        if (ativo && consulta === geracao.current) {
          setCarregando(false)
        }
      }
    }

    void carregar()

    return () => {
      ativo = false
    }
  }, [atualizacao])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace('#', '')

    return lista.filter((s) => {
      const correspondeBusca =
        !termo ||
        [s.codigo, s.id, s.solicitante, s.origem, s.destino].some((campo) =>
          campo.toLowerCase().includes(termo),
        )

      return (
        correspondeBusca &&
        (!data || s.data === data) &&
        (!status || s.status === status)
      )
    })
  }, [lista, busca, data, status])

  const pag = usePaginacao(filtradas, 8)

  async function analisar(id: string, novoStatus: 'aprovar' | 'rejeitar') {
    let motivo = ''

    if (novoStatus === 'rejeitar') {
      const resposta = window.prompt(
        'Informe a justificativa para rejeitar esta solicitação:',
      )

      if (resposta === null) return

      motivo = resposta.trim()

      if (!motivo) {
        setAviso('A justificativa é obrigatória para rejeitar uma solicitação.')
        return
      }
    }

    if (processandoId) return
    geracao.current += 1
    try {
      setProcessandoId(id)
      setErro('')
      setAviso('')

      if (novoStatus === 'aprovar') {
        await aprovarSolicitacao(id)
        setAviso(`Solicitação #${id} aprovada com sucesso.`)
      } else {
        await rejeitarSolicitacao(id, motivo)
        setAviso(`Solicitação #${id} rejeitada com sucesso.`)
      }

      setLista((atual) => atual.map((item) => item.id === id
        ? { ...item, status: novoStatus === 'aprovar' ? 'Aprovada' : 'Recusada' }
        : item))
      // Atualiza a lista com o estado confirmado pelo backend.
      setAtualizacao((valor) => valor + 1)
    } catch (erroApi) {
      setCarregando(false)
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível realizar a operação.',
      )
    } finally {
      setProcessandoId('')
    }
  }

  return (
    <>
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Solicitações</h1>
          <p className="pagina__descricao">
            Analise, aprove e acompanhe todo o ciclo das solicitações de transporte.
          </p>
        </div>
      </div>

      {aviso && (
        <p className="sol-aviso" role="status">
          <Icone nome="check" tamanho={18} /> {aviso}
        </p>
      )}

      {erro && (
        <div className="vazio" role="alert">
          <strong>Não foi possível concluir a operação</strong>
          <p>{erro}</p>
          <button
            type="button"
            className="btn btn--secundario"
            onClick={() => setAtualizacao((valor) => valor + 1)}
          >
            Tentar novamente
          </button>
        </div>
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
            <DatePicker
              id="g-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="g-status">Status</label>
            <Select
              id="g-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </Select>
          </div>

          <p className="sol-total" style={{ padding: 0, alignSelf: 'center' }}>
            {filtradas.length} de {lista.length} solicitações
          </p>

          <span />
        </div>

        {carregando ? (
          <div
            className="sol-carregando"
            aria-busy="true"
            aria-label="Carregando solicitações"
          >
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : erro && lista.length === 0 ? null : filtradas.length === 0 ? (
          <div className="vazio">
            <strong>
              {lista.length === 0
                ? 'Nenhuma solicitação cadastrada'
                : 'Nenhuma solicitação encontrada'}
            </strong>
            <p>
              {lista.length === 0
                ? 'As solicitações recebidas aparecerão aqui.'
                : 'Ajuste a busca ou os filtros.'}
            </p>
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
                      <td className="sol-tabela__ticket">#{s.codigo}</td>

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
                            aria-label={`Ver detalhes de #${s.codigo}`}
                            title="Ver detalhes"
                            onClick={() => navegar(rotaSolicitacao(BASE, s.id))}
                          >
                            <Icone nome="olho" tamanho={18} />
                          </button>

                          {s.status === 'Pendente' && (
                            <>
                              <button
                                type="button"
                                className="sol-acao sol-acao--aprovar"
                                aria-label={`Aprovar #${s.codigo}`}
                                title="Aprovar"
                                disabled={Boolean(processandoId)}
                                onClick={() => void analisar(s.id, 'aprovar')}
                              >
                                <Icone nome="check" tamanho={18} />
                              </button>

                              <button
                                type="button"
                                className="sol-acao sol-acao--recusar"
                                aria-label={`Rejeitar #${s.codigo}`}
                                title="Rejeitar"
                                disabled={Boolean(processandoId)}
                                onClick={() => void analisar(s.id, 'rejeitar')}
                              >
                                <Icone nome="fechar" tamanho={18} />
                              </button>
                            </>
                          )}

                          {(s.status === 'Pendente' || s.status === 'Aprovada') && (
                            <button
                              type="button"
                              className="sol-acao"
                              aria-label={`Editar #${s.codigo}`}
                              title="Editar"
                              onClick={() =>
                                navegar(rotaSolicitacao(BASE, s.id, true))
                              }
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

            <Paginacao
              {...pag}
              rotulo="solicitações"
              aoMudar={pag.setPagina}
            />
          </>
        )}
      </section>
    </>
  )
}
