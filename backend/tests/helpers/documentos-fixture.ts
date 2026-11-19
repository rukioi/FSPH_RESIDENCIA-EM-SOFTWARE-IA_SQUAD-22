import type postgres from 'postgres';
import { criarJwt, type PerfilUsuario } from '../../src/security/jwt.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

export const atoresAnexo = { ADM: 92194, GESTOR_FROTA: 92195, ATENDENTE_SVO: 92196,
  SOLICITANTE_INTERNO: 92197, outroSolicitante: 92198, MOTORISTA: 92199, outroMotorista: 92200 } as const;
export const pngAnexo = Buffer.from('89504e470d0a1a0a01', 'hex');

/** Cenário sintético exclusivo do harness; não usa seed, banco remoto ou credenciais existentes. */
export async function prepararAnexos() {
  const sql = await verifiedSql();
  const admin = await verifiedSql(true);
  const tokens: Record<string, string> = {};
  await sql.begin(async tx => {
    for (const [papel, id] of Object.entries(atoresAnexo)) {
      const perfil: PerfilUsuario = papel === 'outroSolicitante' ? 'SOLICITANTE_INTERNO'
        : papel === 'outroMotorista' ? 'MOTORISTA' : papel as PerfilUsuario;
      await tx`INSERT INTO usuario (id,nome,email,senha_hash,perfil,ativo)
        VALUES (${id},'Fixture anexos S9',${`anexos-${id}@example.invalid`},'sem-login',${perfil},true)`;
      tokens[papel] = await criarJwt({ id: String(id), perfil });
    }
    for (const id of [92194, 92195]) {
      const motorista = id === 92194 ? 92199 : 92200;
      await tx`INSERT INTO veiculo (id,placa,marca,modelo,ano,tipo,is_svo)
        VALUES (${id},${'ANX' + id},'Fixture','S10 TESTE',2026,'RABECÃO_SVO',true)`;
      await tx`INSERT INTO motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh)
        VALUES (${motorista},${motorista},'Fixture motorista',${'CNH-TESTE-' + id},'D','2030-12-31')`;
      await tx`INSERT INTO documento_veiculo (id,veiculo_id,tipo_documento,data_vencimento)
        VALUES (${id},${id},'Documento teste','2028-02-29')`;
    }
  });
  const ids = Object.values(atoresAnexo);
  async function limparUploads() {
    await admin`DELETE FROM documento_historico WHERE autor_id=ANY(${ids}::bigint[])`;
    await admin`DELETE FROM anexo WHERE autor_id=ANY(${ids}::bigint[])`;
    await admin`DELETE FROM anotacao WHERE autor_id=ANY(${ids}::bigint[])`;
    await sql`DELETE FROM log_atividade WHERE usuario_id=ANY(${ids}::bigint[])`;
  }
  async function limpar() {
    try {
      await limparUploads();
      await admin.begin(async tx => {
        for (const tabela of ['documento_veiculo', 'veiculo']) {
          await tx`DELETE FROM ${tx('public.' + tabela)} WHERE id IN (92194,92195)`;
        }
        await tx`DELETE FROM motorista WHERE id IN (92199,92200)`;
        await tx`DELETE FROM usuario WHERE id=ANY(${ids}::bigint[])`;
      });
    } finally { await sql.end(); await admin.end(); }
  }
  return { sql, admin, tokens, limparUploads, limpar };
}

/** Falha real no banco, limitada ao ator da fixture; rollback exercita bytes + auditoria. */
export async function falharAuditoriaAnexo(admin: postgres.Sql, executar: () => Promise<void>) {
  await admin.unsafe(`CREATE FUNCTION public.fixture_anexo_falha() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.usuario_id=92194 THEN RAISE EXCEPTION 'Falha deliberada da fixture'; END IF; RETURN NEW; END $$`);
  try {
    await admin.unsafe('CREATE TRIGGER fixture_anexo_falha BEFORE INSERT ON public.log_atividade FOR EACH ROW EXECUTE FUNCTION public.fixture_anexo_falha()');
    await executar();
  } finally {
    await admin.unsafe('DROP TRIGGER IF EXISTS fixture_anexo_falha ON public.log_atividade');
    await admin.unsafe('DROP FUNCTION public.fixture_anexo_falha()');
  }
}
