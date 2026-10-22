import { sql } from '../../database/connection.js';

export async function buscarPendencias() {
  const motoristas = await sql`
    SELECT id, nome, validade_cnh AS vencimento,
      CASE
        WHEN validade_cnh < CURRENT_DATE THEN 'VENCIDO'
        ELSE 'PROXIMO_VENCIMENTO'
      END AS situacao
    FROM motorista
    WHERE validade_cnh <= CURRENT_DATE + 30
    ORDER BY validade_cnh
  `;

  const documentos = await sql`
    SELECT d.id, d.tipo_documento, d.data_vencimento AS vencimento,
      v.placa, v.modelo,
      CASE
        WHEN d.data_vencimento < CURRENT_DATE THEN 'VENCIDO'
        ELSE 'PROXIMO_VENCIMENTO'
      END AS situacao
    FROM documento_veiculo d
    JOIN veiculo v ON v.id = d.veiculo_id
    WHERE d.data_vencimento <= CURRENT_DATE + 30
    ORDER BY d.data_vencimento
  `;

  return { motoristas, documentos };
}
