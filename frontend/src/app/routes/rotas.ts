import { idValido } from '../../shared/api/bigint';

export const ROTAS = {
  manutencoesAdm: '/admin/manutencoes',
  manutencoesGestor: '/gestor/manutencoes',
  notificacoes: "/notificacoes",
  login: "/login",
  loginMotorista: "/motorista/login",

  // Administrador
  dashboard: "/admin/dashboard",
  configuracoes: "/admin/configuracoes",
  auditoria: "/admin/auditoria",

  // Gestor de Frota
  dashboardGestor: "/gestor/dashboard",
  veiculosGestor: "/gestor/veiculos",
  motoristasGestor: "/gestor/motoristas",
  abastecimentosGestor: "/gestor/abastecimentos",
  indicadoresAbastecimentosGestor: "/gestor/abastecimentos/indicadores",
  solicitacoesGestor: "/gestor/solicitacoes",
  calendarioGestor: "/gestor/calendario",
  relatoriosGestor: '/gestor/relatorios',
  relatorioVeiculos: '/gestor/veiculos/relatorio',
  relatorioMotoristas: '/gestor/motoristas/relatorio',
  relatorioSolicitacoes: '/gestor/solicitacoes/relatorio',
  relatorioAbastecimentos: '/gestor/abastecimentos/relatorio',

  // Solicitante
  novaSolicitacao: '/solicitante/nova-solicitacao',
  minhasSolicitacoes: '/solicitante/minhas-solicitacoes',

  // SVO
  svoRaiz: '/svo',
  svoDashboard: '/svo/dashboard',
  svoRelatorios: '/svo/relatorios',
  svoSolicitacoes: '/svo/solicitacoes',
  svoNovaSolicitacao: '/svo/solicitacoes/nova',
  svoOrdens: '/svo/ordens',
  svoMinhasOrdens: '/svo/equipe/minhas-ordens',

  //Documentos e relatorios
  documentosAdm: "/admin/documentos",
  documentosGestor: "/gestor/documentos",
} as const

export function rotaTriagemSvo(id: string | number): string {
  return `/svo/solicitacoes/${encodeURIComponent(String(id))}/triagem`
}

export function rotaOrdemSvo(id: string | number): string {
  return `/svo/ordens/${encodeURIComponent(String(id))}`
}

export function rotaExecucaoOrdemSvo(id: string | number): string {
  return `/svo/equipe/ordens/${encodeURIComponent(String(id))}/execucao`
}

export function rotaSolicitacaoSvo(id: string): string {
  return `/svo/solicitacoes/${encodeURIComponent(id)}`;
}

/** Os mesmos padrões identificam a página e o perfil permitido antes de montá-la. */
export function lerDetalheSvo(caminho: string) {
  const solicitacao = /^\/svo\/solicitacoes\/([1-9]\d*)(?:\/(triagem|historico))?$/.exec(caminho);
  if (solicitacao) return { id: solicitacao[1], tela: solicitacao[2] === 'triagem' ? 'triagem' as const : 'solicitacao' as const };
  const ordem = /^\/svo\/ordens\/([1-9]\d*)$/.exec(caminho);
  if (ordem) return { id: ordem[1], tela: 'ordem' as const };
  const equipe = /^\/svo\/equipe\/ordens\/([1-9]\d*)\/execucao$/.exec(caminho);
  return equipe ? { id: equipe[1], tela: 'execucao' as const } : null;
}

/** Monta "/base/:id" ou "/base/:id/editar". */
export function rotaSolicitacao(base: string, id: string, editar = false) {
  return `${base}/${encodeURIComponent(id)}${editar ? "/editar" : ""}`;
}

/**
 * Lê detalhes/edição por ID numérico, ex.: "/gestor/solicitacoes/12/editar".
 * Reconhecimento, acesso e seleção da tela usam esta mesma validação.
 */
export function lerRotaSolicitacao(caminho: string, base: string) {
  if (!caminho.startsWith(base + "/")) return null;
  const partes = caminho
    .slice(base.length + 1)
    .split("/");
  if (partes.length === 0 || partes.length > 2) return null;
  if (partes.length === 2 && partes[1] !== "editar") return null;
  let id: string;
  try {
    const parteId = partes[0];
    if (parteId === undefined) return null;
    id = decodeURIComponent(parteId);
  } catch {
    return null;
  }
  if (!/^[0-9]+$/.test(id)) return null;
  return { id, editar: partes[1] === "editar" };
}

export function rotaDetalheAbastecimento(id: string) {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new Error("ID de abastecimento inválido");
  }

  return `${ROTAS.abastecimentosGestor}/${id}`;
}

export function lerRotaDetalheAbastecimento(caminho: string) {
  const prefixo = `${ROTAS.abastecimentosGestor}/`;

  if (!caminho.startsWith(prefixo)) return null;

  const id = caminho.slice(prefixo.length);

  return /^[1-9]\d*$/.test(id) ? id : null;
}

export function rotaHistoricoAbastecimentosVeiculo(id: string) {
  if (!/^-?[1-9]\d*$/.test(id)) {
    throw new Error("ID de veículo inválido");
  }

  return `${ROTAS.veiculosGestor}/${id}/abastecimentos`;
}

export function lerRotaHistoricoAbastecimentosVeiculo(caminho: string) {
  const prefixo = `${ROTAS.veiculosGestor}/`;

  if (!caminho.startsWith(prefixo)) return null;

  const restante = caminho.slice(prefixo.length);
  const resultado = /^(-?[1-9]\d*)\/abastecimentos$/.exec(restante);

  return resultado ? resultado[1] : null;
}

export function baseManutencoes(perfil: string) {
  return perfil === 'ADM' ? ROTAS.manutencoesAdm : ROTAS.manutencoesGestor;
}

function lerId(caminho: string, base: string) {
  if (!caminho.startsWith(base + '/')) return null;
  const id = caminho.slice(base.length + 1);
  return idValido(id) ? id : null;
}

export function lerRotaManutencao(caminho: string) {
  for (const base of [ROTAS.manutencoesAdm, ROTAS.manutencoesGestor]) {
    if (caminho === base) return {base};
    const id = lerId(caminho, base);
    if (id !== null) return {base, id};
  }
  return null;
}

export function rotaDetalheManutencao(base: string, id: string) {
  return base + '/' + encodeURIComponent(id);
}

export function rotaDetalheVeiculo(id: string) {
  return ROTAS.veiculosGestor + '/' + encodeURIComponent(id);
}

export function lerRotaDetalheVeiculo(caminho: string) {
  return lerId(caminho, ROTAS.veiculosGestor);
}

/** Detalhe compartilhado de motorista: mesma validação na rota, no guard e no App. */
export function rotaMotorista(id: string): string {
  if (!/^[0-9]+$/.test(id) || BigInt(id) > 9223372036854775807n) throw new Error('ID de motorista inválido.');
  return `${ROTAS.motoristasGestor}/${BigInt(id).toString()}`;
}
export function lerRotaMotorista(caminho: string): string | null {
  const prefixo = `${ROTAS.motoristasGestor}/`;
  if (!caminho.startsWith(prefixo)) return null;
  const id = caminho.slice(prefixo.length);
  if (!/^[0-9]+$/.test(id) || BigInt(id) > 9223372036854775807n) return null;
  return BigInt(id).toString();
}
