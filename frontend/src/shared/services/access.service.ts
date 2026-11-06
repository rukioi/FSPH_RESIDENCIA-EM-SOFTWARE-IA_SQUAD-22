import { ROTAS, lerDetalheSvo } from '../../app/routes/rotas'

const perfisPorRota: Record<string, string[]> = {
  [ROTAS.dashboard]: ['ADM'],
  [ROTAS.configuracoes]: ['ADM'],
  [ROTAS.auditoria]: ['ADM'],

  [ROTAS.dashboardGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.veiculosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.motoristasGestor]: ['ADM', 'GESTOR_FROTA'],

  [ROTAS.solicitacoesGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.calendarioGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.novaSolicitacao]: ['SOLICITANTE_INTERNO'],
  [ROTAS.minhasSolicitacoes]: ['SOLICITANTE_INTERNO'],

  // Mantida temporariamente para links antigos.
  [ROTAS.svoRaiz]: ['ATENDENTE_SVO'],
  [ROTAS.svoDashboard]: ['ATENDENTE_SVO'],
  [ROTAS.svoSolicitacoes]: ['ATENDENTE_SVO'],
  [ROTAS.svoNovaSolicitacao]: ['ATENDENTE_SVO'],
  [ROTAS.svoMinhasOrdens]: ['MOTORISTA'],
  [ROTAS.svoOrdens]: ['ATENDENTE_SVO'],
}

export function perfilPodeAcessar(
  caminho: string,
  perfil: string,
): boolean {
  const perfisExatos = perfisPorRota[caminho]

  if (perfisExatos) {
    return perfisExatos.includes(perfil)
  }

  const detalhe = lerDetalheSvo(caminho)
  return !!detalhe && perfil === (detalhe.tela === 'execucao' ? 'MOTORISTA' : 'ATENDENTE_SVO')
}
