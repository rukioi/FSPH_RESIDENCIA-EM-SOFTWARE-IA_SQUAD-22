import { sql } from '../../config/db.js';
export const listarLogsAuditoria = async (req, res) => {
    const { usuario_id, data_inicio, data_fim } = req.query;
    try {
        let logs = await sql `
      SELECT 
        l.id, 
        l.usuario_id, 
        l.descricao, 
        l.data_hora,
        u.nome as usuario_nome,
        u.email as usuario_email
      FROM public.log_atividade l
      LEFT JOIN public.usuario u ON l.usuario_id = u.id
      WHERE 
        (${usuario_id ? sql `l.usuario_id = ${Number(usuario_id)}` : sql `TRUE`})
        AND (${data_inicio ? sql `l.data_hora >= ${String(data_inicio)}` : sql `TRUE`})
        AND (${data_fim ? sql `l.data_hora <= ${String(data_fim)}` : sql `TRUE`})
      ORDER BY l.data_hora DESC
    `;
        return res.json(logs);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao consultar logs de auditoria.' });
    }
};
