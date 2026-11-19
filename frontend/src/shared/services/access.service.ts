import { ROTAS, lerDetalheSvo, lerRotaSolicitacao, lerRotaDetalheAbastecimento, lerRotaHistoricoAbastecimentosVeiculo } from '../../app/routes/rotas'

const perfisPorRota: Record<string, string[]> = {
  [ROTAS.relatoriosGestor]: ['ADM','GESTOR_FROTA'],
  [ROTAS.relatorioVeiculos]: ['ADM','GESTOR_FROTA'],
  [ROTAS.relatorioMotoristas]: ['ADM','GESTOR_FROTA'],
  [ROTAS.relatorioSolicitacoes]: ['ADM','GESTOR_FROTA'],
  [ROTAS.relatorioAbastecimentos]: ['ADM','GESTOR_FROTA'],
  [ROTAS.svoRelatorios]: ['ATENDENTE_SVO'],
  [ROTAS.notificacoes]: ['ADM','GESTOR_FROTA','SOLICITANTE_INTERNO','MOTORISTA','ATENDENTE_SVO'],
  [ROTAS.dashboard]: ['ADM'],
  [ROTAS.configuracoes]: ['ADM'],
  [ROTAS.auditoria]: ['ADM'],

  [ROTAS.dashboardGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.veiculosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.motoristasGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.abastecimentosGestor]: ['ADM', 'GESTOR_FROTA'],
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

/** Preserva as telas compartilhadas e separa atendimento SVO da execução da equipe. */
export function perfilPodeAcessar(caminho: string, perfil: string): boolean {
  const solicitacao = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor);
  if (solicitacao && /^[0-9]+$/.test(solicitacao.id)) {
    return perfisPorRota[ROTAS.solicitacoesGestor].includes(perfil);
  }

  if (lerRotaDetalheAbastecimento(caminho) !== null) {
    return perfisPorRota[ROTAS.abastecimentosGestor].includes(perfil);
  }
  if (lerRotaHistoricoAbastecimentosVeiculo(caminho) !== null) {
    return perfisPorRota[ROTAS.veiculosGestor].includes(perfil);
  }

  const perfisExatos = perfisPorRota[caminho]
  if (perfisExatos) return perfisExatos.includes(perfil)
  const detalhe = lerDetalheSvo(caminho)
  return !!detalhe && perfil === (detalhe.tela === 'execucao' ? 'MOTORISTA' : 'ATENDENTE_SVO')
}
