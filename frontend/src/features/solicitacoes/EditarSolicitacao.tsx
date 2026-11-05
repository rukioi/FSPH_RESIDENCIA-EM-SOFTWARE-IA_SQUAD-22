
import { useCallback, useEffect, useState } from 'react'
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
      return 'Pendente'
  }
}

function formatarDataHora(dataHora: string) {
  const data = new Date(dataHora)

  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  const horario = String(data.getHours()).padStart(2, '0')
  const minuto = String(data.getMinutes()).padStart(2, '0')

  return {
    data: `${ano}-${mes}-${dia}`,
    horario: `${horario}:${minuto}`,
  }
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

  const rotaDetalhe = rotaSolicitacao(base, id)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')

    try {
      const resultado = await buscarDetalheSolicitacao(id)
      setDados(resultado)
    } catch (erroApi) {
      setErro(
        erroApi instanceof Error
          ? erroApi.message
          : 'Não foi possível carregar a solicitação.',
      )
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function salvar(valores: ValoresFormulario) {
    if (salvando || !dados) return

    setSalvando(true)
    setErro('')
    setSalvo(false)

    try {
      const dataHoraSaida = new Date(
        `${valores.data}T${valores.horario}:00`,
      ).toISOString()

      const alteracoes: DadosEdicaoSolicitacao = {
        origem: valores.origem.trim(),
        destino: valores.destino.trim(),
        finalidade: valores.finalidade.trim(),
        dataHoraSaida,
        qtdPassageiros: Number(valores.passageiros),
      }

      await editarSolicitacao(id, alteracoes)

      setSalvo(true)

      // Atualiza os dados com o resultado persistido no backend.
      const atualizado = await buscarDetalheSolicitacao(id)
      setDados(atualizado)

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
        <strong>Solicitação não encontrada</strong>
        <p>{erro || `O chamado #${id} não existe ou foi removido.`}</p>
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
        Chamado #{dados.codigoExibicao || dados.codigo}
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
              Alterações salvas com sucesso!
            </p>
          )}

          <SolicitacaoForm
            modo="editar"
            ticket={dados.codigoExibicao || dados.codigo}
            valoresIniciais={montarValores(dados)}
            rotuloEnviar={salvando ? 'Salvando...' : 'Salvar alterações'}
            aoCancelar={() => navegar(rotaDetalhe)}
            aoEnviar={salvar}
          />
        </>
      )}
    </>
  )
}
