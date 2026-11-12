import type { StatusOrdemSvo, StatusTriagemSvo } from '../../shared/types/svo'

export const estadosTriagem: Record<StatusTriagemSvo,string> = {
  AGUARDANDO_TRIAGEM:'Aguardando triagem', CONFIRMADA_SVO:'Confirmada SVO', ENCAMINHADA_IML:'Encaminhada ao IML',
}
export const estadosOrdem: Record<StatusOrdemSvo,string> = {
  PENDENTE_ALOCACAO:'Aguardando despacho', EM_DESLOCAMENTO:'Em deslocamento', EM_TRANSPORTE:'Em transporte',
  CONCLUIDA:'Concluída', CANCELADA:'Cancelada',
}
/** Status desconhecido ou legado não recebe classificação inventada pelo frontend. */
export function nomeStatusSvo(status: string | null, nomes: Record<string,string>): string {
  return status && Object.hasOwn(nomes,status) ? nomes[status] : 'Status não classificado'
}
/** Datas civis da SCRUM-146/149 não passam por Date nem por conversão de fuso. */
export function dataCivilSvo(valor: string | null): string {
  if(!valor) return 'Não informada'
  const partes=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?$/.exec(valor)
  if(!partes) return 'Data indisponível'
  return `${partes[3]}/${partes[2]}/${partes[1]}${partes[4] ? `, ${partes[4]}:${partes[5]}:${partes[6]}` : ''}`
}
