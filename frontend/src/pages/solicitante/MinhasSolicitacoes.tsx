
import { useEffect, useMemo, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { Paginacao, usePaginacao } from '../../shared/components/Paginacao'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import { listarSolicitacoes } from '../../shared/services/solicitacoes.service'
import { STATUS, formatarData } from '../../features/solicitacoes/regras'
import type { Solicitacao } from '../../features/solicitacoes/regras'
import { StatusSolicitacao } from '../../features/solicitacoes/StatusSolicitacao'
import '../../features/solicitacoes/solicitacoes.css'

type Periodo = 'todos' | 'futuras' | 'passadas'

type SolicitacaoDaLista = Solicitacao & {
  codigo: string
}

const HOJE = (() => {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
})()

function converterStatus(status: string | null): Solicitacao['status'] {
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
    case 'CANCELADA':
      return 'Cancelada'
    default:
      return 'Pendente'
  }
}

function converterDataHora(dataHora: string) {
  const data = new Date(dataHora)

  if (Number.isNaN(data.getTime())) {
    return { data: '', horario: '' }
  }

  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  const hora = String(data.getHours()).padStart(2, '0')
  const minuto = String(data.getMinutes()).padStart(2, '0')

  return {
    data: `${ano}-${mes}-${dia}`,
    horario: `${hora}:${minuto}`,
  }
}

export function MinhasSolicitacoes({ usuario }: { usuario: UsuarioSessao }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [lista, setLista] = useState<SolicitacaoDaLista[]>([])
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('todos')
  const [data, setData] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true

    async function carregarSolicitacoes() {
      try {
        setCarregando(true)
        setErro('')

        // A API já identifica o solicitante pela sessão autenticada.
        // Buscamos todas as páginas para manter a paginação local da tela.
        const primeiraPagina = await listarSolicitacoes({
          page: 1,
          limit: 100,
        })

        const solicitacoes = [...primeiraPagina.data]
        const totalPaginas = Math.ceil(
          primeiraPagina.meta.total / primeiraPagina.meta.limit,
        )

        for (let pagina = 2; pagina <= totalPaginas; pagina++) {
          const resultado = await listarSolicitacoes({
            page: pagina,
            limit: 100,
          })

          solicitacoes.push(...resultado.data)
        }

        const convertidas: SolicitacaoDaLista[] = solicitacoes.map((item) => {
          const { data, horario } = converterDataHora(item.dataHoraSaida)

          return {
            id: String(item.id),
            codigo: item.codigoExibicao || item.codigo,
            solicitante: item.solicitante?.nome ?? usuario.nome ?? '',
            instituicao: '',
            data,
            horario,
            origem: item.origem,
            destino: item.destino,
            passageiros: item.qtdPassageiros ?? 0,
            finalidade: item.finalidade ?? '',
            observacao: '',
            documentos: '',
            status: converterStatus(item.status),
            criadaEm: '',
            comentarios: [],
          }
        })

        if (ativo) {
          setLista(convertidas)
        }
      } catch (erroApi) {
        if (ativo) {
          setErro(
            erroApi instanceof Error
              ? erroApi.message
              : 'Não foi possível carregar suas solicitações.',
          )
        }
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }

    void carregarSolicitacoes()

    return () => {
      ativo = false
    }
  }, [usuario.nome, tentativa])

  const filtradas = useMemo(
    () =>
      lista.filter(
        (s) =>
          (!busca ||
            s.codigo.toLowerCase().includes(
              busca.trim().toLowerCase().replace('#', ''),
            ) ||
            s.id.toLowerCase().includes(
              busca.trim().toLowerCase().replace('#', ''),
            )) &&
          (!status || s.status === status) &&
          (!data || s.data === data) &&
          (periodo === 'todos' ||
            (periodo === 'futuras' ? s.data >= HOJE : s.data < HOJE)),
      ),
    [lista, busca, status, periodo, data],
  )

  const pag = usePaginacao(filtradas, 8)
  const temFiltro = !!(busca || status || data || periodo !== 'todos')

  function limpar() {
    setBusca('')
    setStatus('')
    setData('')
    setPeriodo('todos')
  }

  return (
    <>
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Minhas Solicitações</h1>
          <p className="pagina__descricao">
            Acompanhe suas solicitações de transporte.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primario"
          onClick={() => navegar(ROTAS.novaSolicitacao)}
        >
          <Icone nome="mais" tamanho={18} /> Nova solicitação
        </button>
      </div>

      <section className="cartao">
        <div className="sol-filtros">
          <div className="campo sol-busca">
            <label htmlFor="f-ticket">Buscar por ticket</label>
            <Icone nome="busca" tamanho={18} />
            <input
              id="f-ticket"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: TRP-1024"
            />
          </div>

          <div className="campo">
            <label htmlFor="f-status">Status</label>
            <select
              id="f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {STATUS.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="f-periodo">Período</label>
            <select
              id="f-periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
            >
              <option value="todos">Todo o período</option>
              <option value="futuras">Próximas viagens</option>
              <option value="passadas">Viagens passadas</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="f-data">Data</label>
            <input
              id="f-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn--secundario"
            onClick={limpar}
            disabled={!temFiltro}
          >
            <Icone nome="fechar" tamanho={16} /> Limpar
          </button>
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
        ) : erro ? (
          <div className="vazio" role="alert">
            <strong>Não foi possível carregar suas solicitações</strong>
            <p>{erro}</p>
            <button
              type="button"
              className="btn btn--secundario"
              onClick={() => setTentativa((atual) => atual + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="vazio">
            <strong>
              {temFiltro
                ? 'Nenhuma solicitação encontrada'
                : 'Você ainda não tem solicitações'}
            </strong>
            <p>
              {temFiltro
                ? 'Ajuste ou limpe os filtros.'
                : 'Use o botão “Nova solicitação” para registrar a primeira.'}
            </p>
          </div>
        ) : (
          <>
            <p className="sol-total">
              <strong>{filtradas.length}</strong>{' '}
              {filtradas.length === 1
                ? 'solicitação encontrada'
                : 'solicitações encontradas'}
            </p>

            <div className="sol-tabela-wrap">
              <table className="sol-tabela">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Solicitada em</th>
                    <th>Origem → Destino</th>
                    <th>Data prevista</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pag.visiveis.map((s) => (
                    <tr key={s.id}>
                      <td className="sol-tabela__ticket">#{s.codigo}</td>
                      <td>{s.criadaEm ? s.criadaEm.slice(0, 10) : '—'}</td>
                      <td>
                        {s.origem} → {s.destino}
                      </td>
                      <td>
                        {formatarData(s.data)} · {s.horario}
                      </td>
                      <td>
                        <StatusSolicitacao status={s.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="sol-link"
                          onClick={() =>
                            navegar(
                              rotaSolicitacao(
                                ROTAS.minhasSolicitacoes,
                                s.id,
                              ),
                            )
                          }
                        >
                          Ver detalhes <Icone nome="seta" tamanho={16} />
                        </button>
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
