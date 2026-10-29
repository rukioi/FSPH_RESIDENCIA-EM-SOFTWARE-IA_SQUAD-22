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

function enviarJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ data }));
}

function enviarErro(res: ServerResponse, status: number, code: string, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message } }));
}

async function lerBody(req: IncomingMessage): Promise<CorpoAbastecimento> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', err => reject(err));
  });
}

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
    console.error('Erro ao listar abastecimentos:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Não foi possível listar os abastecimentos.');
  }
}

export async function criarAbastecimento(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await lerBody(req);
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
    console.error('Erro ao registrar abastecimento:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao registrar abastecimento.');
  }
}