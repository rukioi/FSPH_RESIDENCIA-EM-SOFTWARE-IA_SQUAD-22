import type { ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

function enviarJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ data }));
}

function enviarErro(res: ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message } }));
}

export async function buscarPendenciasDocumentos(res: ServerResponse) {
  try {
    const alertasCnh = await sql`
      SELECT 
        id, 
        nome, 
        cnh, 
        validade_cnh,
        (validade_cnh::date - CURRENT_DATE) AS dias_restantes
      FROM motorista
      WHERE validade_cnh IS NOT NULL 
        AND validade_cnh::date <= (CURRENT_DATE + INTERVAL '30 days')
      ORDER BY validade_cnh ASC
    `;

    const pendencias = alertasCnh.map((m) => ({
      id: m.id,
      tipo: 'CNH_MOTORISTA',
      descricao: `CNH de ${m.nome} (${m.cnh})`,
      data_validade: m.validade_cnh,
      dias_restantes: Number(m.dias_restantes),
      status: Number(m.dias_restantes) < 0 ? 'VENCIDA' : 'PROXIMA_DO_VENCIMENTO',
    }));

    enviarJson(res, 200, pendencias);
  } catch (err) {
    console.error('Erro ao calcular pendências:', err);
    enviarErro(res, 500, 'ERRO_INTERNO', 'Erro ao processar alertas de documentos.');
  }
}