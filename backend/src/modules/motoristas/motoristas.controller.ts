import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

function enviarJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ data }));
}

function enviarErro(res: ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message } }));
}

async function lerBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', err => reject(err));
  });
}

export async function listarMotoristas(req: IncomingMessage, res: ServerResponse) {
  const motoristas = await sql`SELECT * FROM motorista ORDER BY id DESC`;
  enviarJson(res, 200, motoristas);
}

export async function criarMotorista(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await lerBody(req);
    const { nome, cnh, categoria_cnh, validade_cnh, status } = body;
    
    if (!nome || !cnh || !categoria_cnh || !validade_cnh) {
      return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Nome, CNH, categoria da CNH e validade são obrigatórios.');
    }

    const [existente] = await sql`SELECT id FROM motorista WHERE cnh = ${cnh}`;
    if (existente) return enviarErro(res, 409, 'CNH_DUPLICADA', 'Já existe um motorista cadastrado com esta CNH.');

    const statusOp = status || 'DISPONIVEL';
    
    const [novo] = await sql`
      INSERT INTO motorista (nome, cnh, categoria_cnh, validade_cnh, status) 
      VALUES (${nome}, ${cnh}, ${categoria_cnh}, ${validade_cnh}, ${statusOp}) 
      RETURNING *
    `;
    
    enviarJson(res, 201, novo);
  } catch (err) {
    console.error('Erro ao criar motorista:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao cadastrar motorista.');
  }
}

export async function atualizarMotorista(req: IncomingMessage, res: ServerResponse, id: string) {
  try {
    const body = await lerBody(req);
    const { nome, cnh, validade_cnh } = body;
    const [atualizado] = await sql`
      UPDATE motorista 
      SET nome = COALESCE(${nome}, nome), 
          cnh = COALESCE(${cnh}, cnh), 
          validade_cnh = COALESCE(${validade_cnh}, validade_cnh)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!atualizado) return enviarErro(res, 404, 'NAO_ENCONTRADO', 'Motorista não encontrado.');
    enviarJson(res, 200, atualizado);
  } catch (err) {
    console.error('Erro ao atualizar motorista:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao atualizar motorista.');
  }
}

export async function deletarMotorista(req: IncomingMessage, res: ServerResponse, id: string) {
  try {
    const [deletado] = await sql`DELETE FROM motorista WHERE id = ${id} RETURNING id`;
    if (!deletado) return enviarErro(res, 404, 'NAO_ENCONTRADO', 'Motorista não encontrado.');
    enviarJson(res, 200, { success: true });
  } catch (err) {
    console.error('Erro ao remover motorista:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao remover motorista.');
  }
}