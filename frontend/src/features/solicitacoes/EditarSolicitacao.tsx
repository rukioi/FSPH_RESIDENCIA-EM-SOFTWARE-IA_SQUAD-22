
import { useCallback, useEffect, useRef, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import {
  buscarDetalheSolicitacao,
  editarSolicitacao,
} from '../../shared/services/solicitacoes.service'
import type { DadosEdicaoSolicitacao } from '../../shared/services/solicitacoes.service'
import type { ValoresFormulario, StatusSolicitacao as Status } from './regras'
import { podeEditar } from './regras'
import type { PerfilTela } from './regras'
import { SolicitacaoForm } from './SolicitacaoForm'
import './solicitacoes.css'

type Props = {
  id: string
  perfil: PerfilTela
  base: string
}

type DadosDetalhe = Awaited<ReturnType<typeof buscarDetalheSolicitacao>>

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

function formatarDataHora(dataHora: string) {
  return { data: dataHora.slice(0, 10), horario: dataHora.slice(11, 16) }
}

function montarValores(dados: DadosDetalhe): ValoresFormulario {
  const { data, horario } = formatarDataHora(dados.dataHoraSaida)

  return {
    solicitante: dados.solicitante?.nome ?? 'Não informado',
    instituicao: '—',
    data,
    horario,
    origem: dados.origem,
    destino: dados.destino,
    passageiros: String(dados.qtdPassageiros ?? ''),
    finalidade: dados.finalidade ?? '',
    observacao: '',
    documentos: '',
  }
}

/** Edição de solicitação integrada ao backend. */
export function EditarSolicitacao({ id, perfil, base }: Props) {
  const [dados, setDados] = useState<DadosDetalhe | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)
  const geracao = useRef(0)

  const rotaDetalhe = rotaSolicitacao(base, id)

  const carregar = useCallback(async () => {
    const consulta = ++geracao.current
    setCarregando(true)
    setErro('')

    try {
      const resultado = await buscarDetalheSolicitacao(id)
      if (consulta === geracao.current) setDados(resultado)
    } catch (erroApi) {
      if (consulta !== geracao.current) return
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível carregar a solicitação.',
      )
    } finally {
      if (consulta === geracao.current) setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
    return () => { geracao.current += 1 }
  }, [carregar])

  async function salvar(valores: ValoresFormulario) {
    if (salvando || !dados) return

    setSalvando(true)
    setErro('')
    setSalvo(false)

    try {
      const originais = montarValores(dados)
      const alteracoes: DadosEdicaoSolicitacao = {}
      if (valores.origem.trim() !== originais.origem) alteracoes.origem = valores.origem.trim()
      if (valores.destino.trim() !== originais.destino) alteracoes.destino = valores.destino.trim()
      if (valores.finalidade.trim() !== originais.finalidade) alteracoes.finalidade = valores.finalidade.trim()
      if (valores.passageiros !== originais.passageiros) alteracoes.qtdPassageiros = Number(valores.passageiros)
      if (valores.data !== originais.data || valores.horario !== originais.horario) {
        alteracoes.dataHoraSaida = `${valores.data}T${valores.horario}:00-03:00`
      }
      if (Object.keys(alteracoes).length === 0) {
        setErro('Nenhuma alteração foi informada.')
        return
      }

      const atualizado = await editarSolicitacao(id, alteracoes)
      setDados((anterior) => anterior ? { ...anterior, ...atualizado } : anterior)
      setSalvo(true)

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (erroApi) {
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível salvar as alterações.',
      )
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="cartao vazio">
        <p>Carregando dados da solicitação...</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="cartao vazio">
        <strong>Não foi possível carregar a solicitação</strong>
        <p>{erro || `O chamado #${id} não existe ou foi removido.`}</p>
        <button type="button" className="btn btn--secundario" onClick={() => void carregar()}>
          Tentar novamente
        </button>
        <button
          type="button"
          className="btn btn--secundario"
          style={{ marginTop: 16 }}
          onClick={() => navegar(base)}
        >
          Voltar
        </button>
      </div>
    )
  }

  const status = converterStatus(dados.status)
  const permitido = podeEditar(perfil, status)

  return (
    <>
      <button
        type="button"
        className="sol-voltar"
        onClick={() => navegar(rotaDetalhe)}
      >
        <Icone nome="seta" tamanho={18} />
        Chamado #{(dados.codigoExibicao || dados.codigo).replace(/^#/, '')}
      </button>

      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Editar chamado</h1>
          <p className="pagina__descricao">
            Altere somente os dados pertinentes à solicitação.
          </p>
        </div>
      </div>

      {erro && (
        <p className="sol-aviso sol-aviso--erro" role="alert">
          {erro}
        </p>
      )}

      {!permitido ? (
        <p className="sol-aviso sol-aviso--erro" role="alert">
          Solicitações com status “{status}” não podem ser editadas.
        </p>
      ) : (
        <>
          {salvo && (
            <p className="sol-aviso" role="status">
              <Icone nome="check" tamanho={18} />
              Alterações salvas com sucesso! {status === 'Pendente' && 'A solicitação está pendente de análise.'}
            </p>
          )}

          <SolicitacaoForm
            modo="editar"
            ticket={(dados.codigoExibicao || dados.codigo).replace(/^#/, '')}
            valoresIniciais={montarValores(dados)}
            desabilitado={salvando}
            rotuloEnviar={salvando ? 'Salvando...' : 'Salvar alterações'}
            aoCancelar={() => navegar(rotaDetalhe)}
            aoEnviar={salvar}
          />
        </>
      )}
    </>
  )
}
