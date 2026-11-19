import { lerCorpoJson as lerBody } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarDados as enviarJson, enviarErro } from '../../shared/http/json.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import { conflitoAbastecimentoViagem } from '../viagens/quilometragem-abastecimento.js';
import { ErroHttp, responderErroHttp } from '../../shared/http/errors.js';
import { criarAbastecimentoSchema } from './abastecimentos.schemas.js';
import { validarLeituraAnterior } from './abastecimentos.repository.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import type { z } from 'zod';

type CorpoAbastecimento = z.input<typeof criarAbastecimentoSchema>;

/** Confirma cadastro, comprovante legado e atividade do ator autenticado na mesma transação. */
export async function criarAbastecimento(req: IncomingMessage, res: ServerResponse, autorId: string) {
  try {
    const value = await lerBody(req, 1500 * 1024);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Envie os campos do abastecimento em um objeto JSON.');
    }
    const body = value as CorpoAbastecimento;
    const entrada = criarAbastecimentoSchema.safeParse(value);
    if (!entrada.success) {
      const erroArquivo = entrada.error.issues.some(issue => issue.path[0] === 'comprovante');
      return erroArquivo
        ? enviarErro(res, 400, 'ARQUIVO_INVALIDO', 'Envie uma imagem JPEG ou PNG válida de até 1 MiB.')
        : enviarErro(res, 400, 'DADOS_INVALIDOS', 'Confira os tipos e campos exigidos pelo cadastro atual de abastecimento.');
    }
    const {veiculo_id,motorista_id,posto,litragem,valor_total,quilometragem,data_abastecimento} = entrada.data;
    if (body.tanque_completo !== undefined && typeof body.tanque_completo !== 'boolean') {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Tanque completo deve ser booleano.');
    }
    const tanqueCompleto = body.tanque_completo === true;
    let arquivo: { nome: string; tipo: string; dados: Buffer } | null = null;
    if (body.comprovante !== undefined && body.comprovante !== null) {
      const c = body.comprovante as Record<string, unknown>;
      if (typeof c !== 'object' || Array.isArray(c) || typeof c.nome !== 'string' || !c.nome.trim() ||
          c.nome.length > 255 || Array.from(c.nome).some(ch => ch === '/' || ch === '\\' || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ||
          (c.tipo !== 'image/png' && c.tipo !== 'image/jpeg') || typeof c.dadosBase64 !== 'string' ||
          c.dadosBase64.length > 1398104 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(c.dadosBase64)) {
        return enviarErro(res, 400, 'ARQUIVO_INVALIDO', 'Envie uma imagem JPEG ou PNG válida de até 1 MiB.');
      }
      const bytes = Buffer.from(c.dadosBase64, 'base64');
      const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (bytes.length > 1024 * 1024 || bytes.toString('base64') !== c.dadosBase64 ||
          !(c.tipo === 'image/png' ? png : jpg)) {
        return enviarErro(res, 400, 'ARQUIVO_INVALIDO', 'Envie uma imagem JPEG ou PNG válida de até 1 MiB.');
      }
      // Buffer vai como bytea; um texto '\\x…' seria gravado literalmente pelo driver (bytes corrompidos).
      arquivo = { nome: c.nome.trim(), tipo: c.tipo, dados: bytes };
    }

    const novo = await sql.begin(async tx => {
      // Mesma ordem de bloqueios da alocação: motorista, depois veículo.
      await tx`SELECT id FROM public.motorista WHERE id=${motorista_id ?? null} FOR KEY SHARE`;
      await tx`SELECT id FROM public.veiculo WHERE id=${veiculo_id} FOR UPDATE`;
      const viagens = await tx<{inicio:string;fim:string;inicial:number;final:number}[]>`
        SELECT to_char(v.data_inicio,'YYYY-MM-DD') AS inicio, to_char(v.data_fim,'YYYY-MM-DD') AS fim,
          v.km_inicial AS inicial, v.km_final AS final
        FROM public.viagem v WHERE v.veiculo_id=${veiculo_id} AND v.status='CONCLUIDA'
          AND v.data_inicio IS NOT NULL AND v.data_fim IS NOT NULL
          AND v.km_inicial IS NOT NULL AND v.km_final IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.viagem_correcao c WHERE c.viagem_id=v.id)`;
      if (quilometragem != null && viagens.some(v => conflitoAbastecimentoViagem(data_abastecimento, quilometragem, v))) {
        throw new ErroHttp(409,'ODOMETRO_INCONSISTENTE','Quilometragem incompatível com viagem corrigida.');
      }
      if (quilometragem != null) await validarLeituraAnterior(tx, veiculo_id, data_abastecimento, quilometragem);
      const [registro] = await tx`
      INSERT INTO abastecimento (
        veiculo_id, motorista_id, posto, litragem, valor_total, quilometragem, data_abastecimento,
        tanque_completo, criado_por_id
      ) 
      VALUES (
        ${veiculo_id}, ${motorista_id ?? null}, ${posto || null}, ${litragem}, ${valor_total}, ${quilometragem ?? null}, ${data_abastecimento},
        ${tanqueCompleto}, ${autorId}
      ) 
      RETURNING id, veiculo_id, motorista_id, litragem, valor_total, quilometragem, data_abastecimento,
        criado_em, posto, tanque_completo
      `;
      if (arquivo) await tx`INSERT INTO abastecimento_comprovante (abastecimento_id, nome, tipo, dados)
        VALUES (${registro.id}, ${arquivo.nome}, ${arquivo.tipo}, ${arquivo.dados})`;
      await registrarAtividades(tx, autorId, [{ operacao: 'abastecimento_criado', recursoId: String(registro.id) }]);
      return { ...registro, comprovante_nome: arquivo?.nome ?? null };
    });
    
    enviarJson(res, 201, novo);
  } catch (err) {
    if (responderErroCorpo(res, err)) return;
    if (responderErroHttp(res, err)) return;
    const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
    if (code === '23503') return enviarErro(res, 404, 'REFERENCIA_INEXISTENTE', 'Veículo ou motorista não encontrado.');
    if (['23502','22P02','22001','22003','22007','22008'].includes(String(code))) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Confira os tipos e campos exigidos pelo cadastro atual de abastecimento.');
    }
    registrarFalha(err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao registrar abastecimento.');
  }
}

/** Retorna a imagem vinculada ao abastecimento sem expor bytes na listagem. */
export async function baixarComprovante(res: ServerResponse, id: string): Promise<void> {
  try {
    if (!/^[0-9]{1,19}$/.test(id) || BigInt(id) > 9223372036854775807n) {
      enviarErro(res, 404, 'NAO_ENCONTRADO', 'Comprovante n\u00e3o encontrado.');
      return;
    }
    const [row] = await sql`SELECT tipo, dados FROM abastecimento_comprovante WHERE abastecimento_id = ${id}`;
    if (!row || !row.dados) {
      enviarErro(res, 404, 'NAO_ENCONTRADO', 'Comprovante não encontrado.');
      return;
    }
    res.setHeader('Content-Type', String(row.tipo));
    res.setHeader('Content-Disposition', 'attachment; filename="comprovante"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(row.dados as Buffer);
  } catch (err) {
    registrarFalha(err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Não foi possível obter o comprovante.');
  }
}
