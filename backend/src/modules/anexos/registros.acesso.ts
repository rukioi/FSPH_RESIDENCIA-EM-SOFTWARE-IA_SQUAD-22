import type postgres from 'postgres';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import type { VinculoRegistro } from './anexos.schemas.js';

export const registros = {
  SOLICITACAO_VIAGEM: { tabela: 'solicitacao_viagem', coluna: 'solicitacao_viagem_id' },
  SOLICITACAO_SVO: { tabela: 'solicitacao_obito', coluna: 'solicitacao_obito_id' },
  VIAGEM: { tabela: 'viagem', coluna: 'viagem_id' },
  ORDEM_SVO: { tabela: 'ordem_coleta', coluna: 'ordem_coleta_id' },
  ABASTECIMENTO: { tabela: 'abastecimento', coluna: 'abastecimento_id' },
  VEICULO: { tabela: 'veiculo', coluna: 'veiculo_id' },
  MOTORISTA: { tabela: 'motorista', coluna: 'motorista_id' },
  DOCUMENTO_VEICULO: { tabela: 'documento_veiculo', coluna: 'documento_veiculo_id' },
} as const;
const negado = () => new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
export const registroAusente = () => new ErroHttp(404, 'NAO_ENCONTRADO', 'Registro não encontrado.');

/** Nega perfis fora do domínio antes de consultar existência; não usa claims antigos. */
export function conferirPerfilRegistro(usuario: UsuarioAutenticado, tipo: VinculoRegistro['tipoRegistro']) {
  const gestao = usuario.perfil === 'ADM' || usuario.perfil === 'GESTOR_FROTA';
  const permitido = tipo === 'SOLICITACAO_SVO' ? usuario.perfil === 'ATENDENTE_SVO'
    : tipo === 'ORDEM_SVO' ? ['ATENDENTE_SVO', 'MOTORISTA'].includes(usuario.perfil)
    : tipo === 'SOLICITACAO_VIAGEM' ? gestao || usuario.perfil === 'SOLICITANTE_INTERNO'
    : tipo === 'VIAGEM' ? gestao || usuario.perfil === 'MOTORISTA' : gestao;
  if (!permitido) throw negado();
}

/** Confere FK e proprietário atual sob lock do registro; IDs alheios recebem o mesmo 404. */
export async function autorizarRegistro(tx: postgres.TransactionSql, usuario: UsuarioAutenticado,
  vinculo: VinculoRegistro) {
  const { tipoRegistro: tipo, registroId } = vinculo;
  conferirPerfilRegistro(usuario, tipo);
  const tabela = registros[tipo].tabela;
  const [registro] = await tx`SELECT id FROM ${tx('public.' + tabela)} WHERE id=${registroId} FOR SHARE`;
  if (!registro) throw registroAusente();
  if (usuario.perfil === 'SOLICITANTE_INTERNO') {
    const [proprio] = await tx`SELECT id FROM public.solicitacao_viagem
      WHERE id=${registroId} AND solicitante_id=${usuario.id}`;
    if (!proprio) throw registroAusente();
  }
  if (usuario.perfil === 'MOTORISTA') {
    const [proprio] = await tx`SELECT m.id FROM ${tx('public.' + tabela)} r
      JOIN public.motorista m ON m.id=r.motorista_id
      WHERE r.id=${registroId} AND m.usuario_id=${usuario.id} FOR SHARE OF m`;
    if (!proprio) throw registroAusente();
  }
}
