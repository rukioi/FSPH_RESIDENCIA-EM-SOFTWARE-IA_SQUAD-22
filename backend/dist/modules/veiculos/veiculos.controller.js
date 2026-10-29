import { sql } from '../../config/db.js';
function enviarJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ data }));
}
function enviarErro(res, status, code, message) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code, message } }));
}
async function lerBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', err => reject(err));
    });
}
export async function listarVeiculos(req, res) {
    const veiculos = await sql `SELECT * FROM veiculo ORDER BY id DESC`;
    enviarJson(res, 200, veiculos);
}
export async function criarVeiculo(req, res) {
    try {
        const body = await lerBody(req);
        const { placa, modelo, marca, ano, tipo, capacidade_obitos, quilometragem_atual, status, is_svo } = body;
        if (!placa || !modelo || !marca || !ano) {
            return enviarErro(res, 400, 'DADOS_INVALIDOS', 'Placa, modelo, marca e ano são obrigatórios.');
        }
        const [existente] = await sql `SELECT id FROM veiculo WHERE placa = ${placa}`;
        if (existente)
            return enviarErro(res, 409, 'PLACA_DUPLICADA', 'Já existe um veículo cadastrado com esta placa.');
        const tipoVeiculo = tipo || 'PASSEIO';
        const capOb = capacidade_obitos ?? 0;
        const kmAtual = quilometragem_atual || 0;
        const statusOp = status || 'DISPONIVEL';
        const isSvoVal = is_svo ?? false;
        const [novo] = await sql `
      INSERT INTO veiculo (
        placa, modelo, marca, ano, tipo, capacidade_obitos, quilometragem_atual, status, is_svo
      ) 
      VALUES (
        ${placa}, ${modelo}, ${marca}, ${ano}, ${tipoVeiculo}, ${capOb}, ${kmAtual}, ${statusOp}, ${isSvoVal}
      ) 
      RETURNING *
    `;
        enviarJson(res, 201, novo);
    }
    catch (err) {
        console.error('Erro ao criar veículo:', err);
        enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao cadastrar veículo.');
    }
}
export async function atualizarVeiculo(req, res, id) {
    try {
        const body = await lerBody(req);
        const { placa, marca, modelo, status } = body;
        const [atualizado] = await sql `
      UPDATE veiculo 
      SET placa = COALESCE(${placa}, placa), 
          marca = COALESCE(${marca}, marca), 
          modelo = COALESCE(${modelo}, modelo), 
          status = COALESCE(${status}, status)
      WHERE id = ${id}
      RETURNING *
    `;
        if (!atualizado)
            return enviarErro(res, 404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
        enviarJson(res, 200, atualizado);
    }
    catch (err) {
        console.error('Erro ao atualizar veículo:', err);
        enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao atualizar veículo.');
    }
}
export async function deletarVeiculo(req, res, id) {
    try {
        const [deletado] = await sql `DELETE FROM veiculo WHERE id = ${id} RETURNING id`;
        if (!deletado)
            return enviarErro(res, 404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
        enviarJson(res, 200, { success: true });
    }
    catch (err) {
        console.error('Erro ao remover veículo:', err);
        enviarErro(res, 500, 'ERRO_INTERNO', 'Falha ao remover veículo.');
    }
}
