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
  [ROTAS.documentosAdm]: ['ADM'],

  [ROTAS.dashboardGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.veiculosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.motoristasGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.abastecimentosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.indicadoresAbastecimentosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.solicitacoesGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.calendarioGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.novaSolicitacao]: ['SOLICITANTE_INTERNO'],
  [ROTAS.minhasSolicitacoes]: ['SOLICITANTE_INTERNO'],
  [ROTAS.documentosGestor]: ['ADM', 'GESTOR_FROTA'],

  // Mantida temporariamente para links antigos.
  [ROTAS.svoRaiz]: ['ATENDENTE_SVO'],
  [ROTAS.svoDashboard]: ['ATENDENTE_SVO'],
  [ROTAS.svoSolicitacoes]: ['ATENDENTE_SVO'],
  [ROTAS.svoNovaSolicitacao]: ['ATENDENTE_SVO'],
  [ROTAS.svoMinhasOrdens]: ['MOTORISTA'],
  [ROTAS.svoOrdens]: ['ATENDENTE_SVO'],
}

/** Distingue uma URL inexistente de uma rota conhecida sem permissão. */
export function rotaConhecida(caminho: string): boolean {
  if (perfisPorRota[caminho]) return true

  const solicitacaoGestor = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor)
  if (solicitacaoGestor) return true

  const solicitacaoSolicitante = lerRotaSolicitacao(caminho, ROTAS.minhasSolicitacoes)
  if (solicitacaoSolicitante) return true

  return (
    lerRotaDetalheAbastecimento(caminho) !== null ||
    lerRotaHistoricoAbastecimentosVeiculo(caminho) !== null ||
    lerDetalheSvo(caminho) !== null
  )
}

/** Preserva as telas compartilhadas e separa atendimento SVO da execução da equipe. */
export function perfilPodeAcessar(caminho: string, perfil: string): boolean {
  const solicitacao = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor);
  if (solicitacao) {
    return perfisPorRota[ROTAS.solicitacoesGestor]?.includes(perfil) ?? false;
  }

  const solicitacaoSolicitante = lerRotaSolicitacao(caminho, ROTAS.minhasSolicitacoes);
  if (solicitacaoSolicitante) {
    return perfisPorRota[ROTAS.minhasSolicitacoes]?.includes(perfil) ?? false;
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
