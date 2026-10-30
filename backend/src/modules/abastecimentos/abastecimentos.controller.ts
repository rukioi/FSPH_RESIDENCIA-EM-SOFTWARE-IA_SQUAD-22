import { lerCorpoJson as lerBody } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarDados as enviarJson, enviarErro } from '../../shared/http/json.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

interface CorpoAbastecimento {
  veiculo_id?: number;
  motorista_id?: number;
  posto?: string;
  litragem?: number;
  valor_total?: number;
  quilometragem?: number;
  data_abastecimento?: string;
}

/** Lista abastecimentos pelo pool compartilhado com o envelope existente. */
export async function listarAbastecimentos(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const lista = await sql`
      SELECT a.*, v.placa as veiculo_placa, m.nome as motorista_nome 
      FROM abastecimento a
      LEFT JOIN veiculo v ON a.veiculo_id = v.id
      LEFT JOIN motorista m ON a.motorista_id = m.id
      ORDER BY a.id DESC
    `;
    enviarJson(res, 200, lista);
  } catch (err) {
    if (responderErroCorpo(res, err)) return;
    registrarFalha(err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Não foi possível listar os abastecimentos.');
  }
}

/** Lê JSON limitado e preserva o cadastro de abastecimento existente. */
export async function criarAbastecimento(req: IncomingMessage, res: ServerResponse) {
  try {
    const value = await lerBody(req);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Envie os campos do abastecimento em um objeto JSON.');
    }
    const body = value as CorpoAbastecimento;
    const { 
      veiculo_id, 
      motorista_id, 
      posto, 
      litragem, 
      valor_total, 
      quilometragem, 
      data_abastecimento 
    } = body;
    
    if (!veiculo_id || !litragem || !valor_total || !data_abastecimento) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Veículo, litragem, valor total e data do abastecimento são obrigatórios.');
    }

    // Apenas forma técnica compatível com as colunas atuais, sem nova regra de produto.
    const numeric = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v));
    const identifier = (v: unknown) => typeof v === 'number' ? Number.isSafeInteger(v) : typeof v === 'string' && /^-?\d+$/.test(v);
    const validDate = typeof data_abastecimento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data_abastecimento) &&
      !Number.isNaN(Date.parse(data_abastecimento)) && new Date(data_abastecimento).toISOString().slice(0,10) === data_abastecimento;
    if (!identifier(veiculo_id) || !identifier(motorista_id) || !numeric(litragem) || !numeric(valor_total) ||
        !Number.isInteger(quilometragem) || !validDate || (posto != null && typeof posto !== 'string')) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Confira os tipos e campos exigidos pelo cadastro atual de abastecimento.');
    }

    const [novo] = await sql`
      INSERT INTO abastecimento (
        veiculo_id, motorista_id, posto, litragem, valor_total, quilometragem, data_abastecimento
      ) 
      VALUES (
        ${veiculo_id}, ${motorista_id ?? null}, ${posto || null}, ${litragem}, ${valor_total}, ${quilometragem ?? null}, ${data_abastecimento}
      ) 
      RETURNING *
    `;
    
    enviarJson(res, 201, novo);
  } catch (err) {
    if (responderErroCorpo(res, err)) return;
    const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
    if (code === '23503') return enviarErro(res, 404, 'REFERENCIA_INEXISTENTE', 'Veículo ou motorista não encontrado.');
    if (['23502','22P02','22001','22003','22007','22008'].includes(String(code))) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Confira os tipos e campos exigidos pelo cadastro atual de abastecimento.');
    }
    registrarFalha(err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao registrar abastecimento.');
  }
}
