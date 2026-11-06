
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { navegar } from '../../app/routes/router'
import { rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import {
  buscarDetalheSolicitacao,
  buscarHistoricoSolicitacao,
  aprovarSolicitacao,
  rejeitarSolicitacao,
} from '../../shared/services/solicitacoes.service'
import {
  formatarData,
  podeAnalisar,
  podeEditar,
} from './regras'
import type {
  PerfilTela,
  StatusSolicitacao as Status,
  Solicitacao,
  Comentario,
} from './regras'
import { StatusSolicitacao } from './StatusSolicitacao'
import { TimelineAcompanhamento } from './TimelineAcompanhamento'
import { ComentariosCard } from './ComentariosCard'
import './solicitacoes.css'
import './DetalheSolicitacao.css'

type Props = {
  id: string
  perfil: PerfilTela
  base: string
  rotuloVoltar: string
  autor: { nome: string; cargo: string }
}

type DadosDetalhe = Awaited<ReturnType<typeof buscarDetalheSolicitacao>>
type ItemHistorico = {
  id: number | string
  descricao: string
  dataHora: string | null
  responsavel?: {
    id: number | string
    nome: string | null
  } | null
}

type DadosHistorico = {
  data: ItemHistorico[]
  meta: {
    page: number
    limit: number
    total: number
  }
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

function converterData(dataHora: string) {
  return { data: formatarData(dataHora.slice(0, 10)), horario: dataHora.slice(11, 16) }
}

function montarSolicitacao(dados: DadosDetalhe): Solicitacao {
  const { data, horario } = converterData(dados.dataHoraSaida)

  return {
    id: String(dados.id),
    solicitante: dados.solicitante?.nome ?? 'Não informado',
    instituicao: '—',
    data,
    horario,
    origem: dados.origem,
    destino: dados.destino,
    passageiros: dados.qtdPassageiros ?? 0,
    finalidade: dados.finalidade ?? 'Não informada',
    observacao: '',
    documentos: '',
    status: converterStatus(dados.status),
    criadaEm: '—',
    motorista: dados.motorista?.nome,
    veiculo: dados.veiculo
      ? `${dados.veiculo.modelo} - ${dados.veiculo.placa}`
      : undefined,
    comentarios: [],
  }
}

function formatarDataHistorico(dataHora: string | null) {
  if (!dataHora) return 'Data não informada'
  return `${formatarData(dataHora.slice(0, 10))} ${dataHora.slice(11, 16)}`
}

/** Tela de detalhamento compartilhada por Gestor e Solicitante. */
export function DetalheSolicitacao({
  id,
  perfil,
  base,
  rotuloVoltar,
  autor,
}: Props) {
  const [dados, setDados] = useState<DadosDetalhe | null>(null)
  const [historico, setHistorico] = useState<DadosHistorico['data']>([])
  const [erroHistorico, setErroHistorico] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [processando, setProcessando] = useState(false)
  const [aviso, setAviso] = useState('')
  const geracao = useRef(0)
  const [paginaHistorico, setPaginaHistorico] = useState(1)
  const [totalHistorico, setTotalHistorico] = useState(0)

  const carregar = useCallback(async () => {
    const consulta = ++geracao.current
    setCarregando(true)
    setErro('')

    try {
      const detalhe = await buscarDetalheSolicitacao(id)
      if (consulta !== geracao.current) return
      setDados(detalhe)

      try {
        const resultadoHistorico = await buscarHistoricoSolicitacao(id, { page: paginaHistorico })
        if (consulta !== geracao.current) return
        setHistorico(resultadoHistorico.data)
        setTotalHistorico(resultadoHistorico.meta.total)
        setErroHistorico(false)
      } catch {
        if (consulta !== geracao.current) return
        // A falha no histórico não impede a exibição dos detalhes.
        setHistorico([])
        setErroHistorico(true)
      }
    } catch (erroApi) {
      if (consulta !== geracao.current) return
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível carregar os detalhes da solicitação.',
      )
    } finally {
      if (consulta === geracao.current) setCarregando(false)
    }
  }, [id, paginaHistorico])

  useEffect(() => {
    void carregar()
    return () => { geracao.current += 1 }
  }, [carregar])

  async function analisar(acao: 'aprovar' | 'rejeitar') {
    if (processando) return

    let motivo = ''

    if (acao === 'rejeitar') {
      const informado = window.prompt('Informe o motivo da recusa:')

      if (informado === null) return

      motivo = informado.trim()

      if (!motivo) {
        setErro('Informe um motivo para recusar a solicitação.')
        return
      }
    }

    setProcessando(true)
    geracao.current += 1
    setErro('')
    setAviso('')

    try {
      if (acao === 'aprovar') {
        await aprovarSolicitacao(id)
        setAviso('Solicitação aprovada com sucesso.')
      } else {
        await rejeitarSolicitacao(id, motivo)
        setAviso('Solicitação recusada com sucesso.')
      }

      await carregar()
    } catch (erroApi) {
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível atualizar a solicitação.',
      )
    } finally {
      setProcessando(false)
    }
  }

  if (carregando) {
    return (
      <div className="cartao vazio">
        <p>Carregando detalhes da solicitação...</p>
      </div>
    )
  }

  if (erro && !dados) {
    return (
      <div className="cartao vazio">
        <strong>Não foi possível carregar a solicitação</strong>
        <p>{erro}</p>
        <button type="button" className="btn btn--secundario" onClick={() => void carregar()}>Tentar novamente</button>
        <button
          type="button"
          className="btn btn--secundario"
          style={{ marginTop: 16 }}
          onClick={() => navegar(base)}
        >
          {rotuloVoltar}
        </button>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="cartao vazio">
        <strong>Solicitação não encontrada</strong>
        <p>O chamado não existe ou foi removido.</p>
        <button
          type="button"
          className="btn btn--secundario"
          style={{ marginTop: 16 }}
          onClick={() => navegar(base)}
        >
          {rotuloVoltar}
        </button>
      </div>
    )
  }

  const s = montarSolicitacao(dados)
  const codigo = (dados.codigoExibicao || dados.codigo).replace(/^#/, '')
  const mostrarAcoes = podeAnalisar(perfil, s.status) || podeEditar(perfil, s.status)

  const info: [string, ReactNode][] = [
    ['Número do chamado', `#${codigo}`],
    ['Solicitante', s.solicitante],
    ['Instituição', s.instituicao],
    ['Data', s.data],
    ['Horário', s.horario],
    ['Origem', s.origem],
    ['Destino', s.destino],
    [
      'Passageiros',
      dados.qtdPassageiros === null ? 'Não informado' : `${s.passageiros} ${s.passageiros === 1 ? 'passageiro' : 'passageiros'}`,
    ],
    ['Finalidade', s.finalidade],
    ['Status', <StatusSolicitacao key="st" status={s.status} />],
  ]

  return (
    <>
      <button
        type="button"
        className="sol-voltar"
        onClick={() => navegar(base)}
      >
        <Icone nome="seta" tamanho={18} /> {rotuloVoltar}
      </button>

      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Chamado #{codigo}</h1>
          <p className="pagina__descricao">
            Detalhes, andamento e comentários da solicitação.
          </p>
        </div>
      </div>

      {aviso && (
        <p className="sol-aviso" role="status">
          <Icone nome="check" tamanho={18} /> {aviso}
        </p>
      )}

      {erro && (
        <p className="sol-aviso" role="alert">
          {erro}
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
                    disabled={processando}
                    onClick={() => void analisar('aprovar')}
                  >
                    <Icone nome="check" tamanho={18} />
                    Aprovar
                  </button>

                  <button
                    type="button"
                    className="btn btn--secundario detalhe__recusar"
                    disabled={processando}
                    onClick={() => void analisar('rejeitar')}
                  >
                    <Icone nome="fechar" tamanho={18} />
                    Recusar
                  </button>
                </>
              )}

              {podeEditar(perfil, s.status) && (
                <button
                  type="button"
                  className="btn btn--secundario"
                  onClick={() =>
                    navegar(rotaSolicitacao(base, s.id, true))
                  }
                >
                  <Icone nome="editar" tamanho={18} />
                  Editar
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {s.status !== 'Não informado' && <TimelineAcompanhamento solicitacao={s} />}

      <section className="cartao sol-cartao" aria-labelledby="historico-titulo">
        <div className="sol-cartao__topo">
          <h2 id="historico-titulo">Histórico da solicitação</h2>
        </div>

        <div className="sol-cartao__corpo">
          {erroHistorico ? (
            <p role="alert">Histórico indisponível. <button type="button" onClick={() => void carregar()}>Tentar novamente</button></p>
          ) : historico.length === 0 ? (
            <p>Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="comentarios__lista">
              {historico.map((item) => (
                <li key={item.id} className="comentarios__item">
                  <div className="comentarios__autor">
                    <strong>{item.responsavel?.nome || 'Sistema'}</strong>
                    <small>{formatarDataHistorico(item.dataHora)}</small>
                  </div>
                  <p>{item.descricao}</p>
                </li>
              ))}
            </ul>
          )}
          {totalHistorico > 20 && !erroHistorico && (
            <div className="sol-acoes-form" aria-label="Paginação do histórico">
              <button type="button" className="btn btn--secundario" disabled={paginaHistorico === 1} onClick={() => setPaginaHistorico(p => p - 1)}>Anterior</button>
              <span>Página {paginaHistorico} de {Math.ceil(totalHistorico / 20)}</span>
              <button type="button" className="btn btn--secundario" disabled={paginaHistorico * 20 >= totalHistorico} onClick={() => setPaginaHistorico(p => p + 1)}>Próxima</button>
            </div>
          )}
        </div>
      </section>

      {perfil !== 'gestor' && <ComentariosCard
        observacao=""
        comentariosIniciais={[] as Comentario[]}
        autor={autor}
      />}
    </>
  )
}
