export const ROTAS = {
  notificacoes: "/notificacoes",
  login: "/login",

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

  // Solicitante
  novaSolicitacao: "/solicitante/nova-solicitacao",
  minhasSolicitacoes: "/solicitante/minhas-solicitacoes",
} as const;

/** Monta "/base/:id" ou "/base/:id/editar". */
export function rotaSolicitacao(base: string, id: string, editar = false) {
  return `${base}/${encodeURIComponent(id)}${editar ? "/editar" : ""}`;
}

/**
 * Lê caminhos com parâmetro, ex.: "/gestor/solicitacoes/TRP-1024/editar".
 * Retorna null quando o caminho não começa com a base informada.
 */
export function lerRotaSolicitacao(caminho: string, base: string) {
  if (!caminho.startsWith(base + "/")) return null;
  const partes = caminho
    .slice(base.length + 1)
    .split("/")
    .filter(Boolean);
  if (partes.length === 0 || partes.length > 2) return null;
  if (partes.length === 2 && partes[1] !== "editar") return null;
  let id: string;
  try {
    id = decodeURIComponent(partes[0]);
  } catch {
    return null;
  }
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
  if (!/^[1-9]\d*$/.test(id)) {
    throw new Error("ID de veículo inválido");
  }

  return `${ROTAS.veiculosGestor}/${id}/abastecimentos`;
}

export function lerRotaHistoricoAbastecimentosVeiculo(caminho: string) {
  const prefixo = `${ROTAS.veiculosGestor}/`;

  if (!caminho.startsWith(prefixo)) return null;

  const restante = caminho.slice(prefixo.length);
  const resultado = /^([1-9]\d*)\/abastecimentos$/.exec(restante);

  return resultado ? resultado[1] : null;
}
