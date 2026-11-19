import { ApiError } from '../../shared/api/errors'
import type {
  DocumentoGestao,
  FiltrosDocumentos,
} from '../../shared/services/documentos.service'

export type AbaDocumentos =
  | 'TODOS'
  | 'VEICULOS'
  | 'MOTORISTAS'
  | 'A_VENCER'
  | 'VENCIDO'

export type SituacaoVisual = 'REGULAR' | 'A_VENCER' | 'HOJE' | 'VENCIDO'

export const ABAS_DOCUMENTOS: { id: AbaDocumentos; nome: string }[] = [
  { id: 'TODOS', nome: 'Todos' },
  { id: 'VEICULOS', nome: 'Veículos' },
  { id: 'MOTORISTAS', nome: 'Motoristas' },
  { id: 'A_VENCER', nome: 'A vencer' },
  { id: 'VENCIDO', nome: 'Vencidos' },
]

export const ROTULO_SITUACAO: Record<SituacaoVisual, string> = {
  REGULAR: 'Regular',
  A_VENCER: 'A vencer',
  HOJE: 'Vence hoje',
  VENCIDO: 'Vencido',
}

/** Converte a aba em parâmetros realmente aceitos por /api/documentos/consulta. */
export function filtrosDaAba(
  aba: AbaDocumentos,
  atuais: FiltrosDocumentos = {},
): FiltrosDocumentos {
  const filtros = { ...atuais }
  delete filtros.tipo
  delete filtros.situacao
  delete filtros.page
  delete filtros.limit

  if (aba === 'VEICULOS') {
    filtros.tipo = 'DOCUMENTO_VEICULO'
    delete filtros.motoristaId
  }
  if (aba === 'MOTORISTAS') {
    filtros.tipo = 'CNH_MOTORISTA'
    delete filtros.veiculoId
  }
  if (aba === 'A_VENCER') filtros.situacao = 'A_VENCER'
  if (aba === 'VENCIDO') filtros.situacao = 'VENCIDO'

  return filtros
}

/**
 * Usa apenas os campos calculados pelo PostgreSQL. Não há janela local de 30 dias:
 * A_VENCER continua sendo qualquer validade futura, conforme o contrato atual.
 */
export function situacaoDocumento(
  documento: Pick<DocumentoGestao, 'diasRestantes' | 'regular'>,
): SituacaoVisual {
  if (documento.diasRestantes < 0) return 'VENCIDO'
  if (documento.diasRestantes === 0) return 'HOJE'
  if (documento.regular === true) return 'REGULAR'
  return 'A_VENCER'
}

export function nomeDocumento(documento: DocumentoGestao): string {
  if (documento.tipo === 'CNH_MOTORISTA') {
    return documento.categoriaCnh
      ? `CNH ${documento.categoriaCnh}`
      : 'CNH'
  }
  return documento.tipoDocumento ?? 'Documento do veículo'
}

export function relacionadoDocumento(documento: DocumentoGestao): string {
  if (!documento.registroId) return '—'
  return documento.tipo === 'CNH_MOTORISTA'
    ? `Motorista #${documento.registroId}`
    : `Veículo #${documento.registroId}`
}

export function dataBr(data: string | null | undefined): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

export function dataHoraBr(data: string): string {
  const valor = new Date(data)
  return Number.isNaN(valor.getTime())
    ? '—'
    : valor.toLocaleString('pt-BR')
}

export function descricaoDias(dias: number): string {
  if (dias < 0) {
    const atraso = Math.abs(dias)
    return `${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso`
  }
  if (dias === 0) return 'Vence hoje'
  return `${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`
}

export function foiCancelamento(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError'
}

export function mensagemErroDocumentos(
  erro: unknown,
  alternativa = 'Não foi possível concluir a consulta. Tente novamente.',
): string {
  if (!(erro instanceof ApiError)) return alternativa

  const mensagens: Record<number, string> = {
    400: 'Confira os dados informados e tente novamente.',
    401: 'Sua sessão expirou. Entre novamente para continuar.',
    403: 'Seu perfil não tem permissão para acessar estes documentos.',
    404: 'O documento ou arquivo solicitado não foi encontrado.',
    409: 'Este documento foi alterado por outra pessoa. Atualize os detalhes antes de salvar.',
    413: 'O arquivo excede o limite aceito pelo servidor.',
    415: 'O formato do arquivo não é aceito pelo servidor.',
  }

  return mensagens[erro.status] ?? erro.message ?? alternativa
}
