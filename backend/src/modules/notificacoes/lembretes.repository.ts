import { sql } from '../../database/connection.js';

/** Gera um lote idempotente de avisos para reservas futuras, sob bloqueio da solicitacao. */
export async function gerarLembretes(antecedenciaMinutos:number, agora = new Date().toISOString()): Promise<number> {
  return sql.begin(async tx=>{
    const pedidos=await tx`SELECT s.id::text FROM public.solicitacao_viagem s
      JOIN public.viagem v ON v.solicitacao_id=s.id
      JOIN public.motorista m ON m.id=v.motorista_id
      JOIN public.usuario u ON u.id=m.usuario_id
      WHERE s.status IN ('AGENDADA','PRONTA_PARA_INICIAR') AND v.status='AGENDADA' AND u.ativo=true
        AND s.motorista_id=v.motorista_id AND s.veiculo_id=v.veiculo_id
        AND s.data_hora_saida > (${agora}::text::timestamptz AT TIME ZONE 'America/Maceio')
        AND s.data_hora_saida <= (${agora}::text::timestamptz AT TIME ZONE 'America/Maceio') + ${antecedenciaMinutos}::int * interval '1 minute'
        AND NOT EXISTS (SELECT 1 FROM public.notificacao n WHERE n.usuario_id=u.id
          AND n.chave='viagem:'||v.id::text||':lembrete:'||to_char(s.data_hora_saida,'YYYYMMDDHH24MISSUS')||':'||m.id::text
          AND n.titulo <> 'Lembrete desatualizado')
      ORDER BY s.data_hora_saida,s.id LIMIT 100 FOR UPDATE OF s SKIP LOCKED`;
    let total=0;
    for(const pedido of pedidos){
      const [dados]=await tx`SELECT v.id::text AS viagem,m.id::text AS motorista,u.id::text AS usuario,s.codigo,
        to_char(s.data_hora_saida,'YYYYMMDDHH24MISSUS') AS horario
        FROM public.solicitacao_viagem s JOIN public.viagem v ON v.solicitacao_id=s.id
        JOIN public.motorista m ON m.id=v.motorista_id JOIN public.usuario u ON u.id=m.usuario_id
        WHERE s.id=${pedido.id} AND s.status IN ('AGENDADA','PRONTA_PARA_INICIAR') AND v.status='AGENDADA' AND u.ativo=true
          AND s.motorista_id=v.motorista_id AND s.veiculo_id=v.veiculo_id FOR SHARE OF m,u`;
      if(!dados)continue;
      const chave='viagem:'+dados.viagem+':lembrete:'+dados.horario+':'+dados.motorista;
      const rows=await tx`INSERT INTO public.notificacao(usuario_id,chave,titulo,descricao,categoria,tipo,viagem_id)
        VALUES (${dados.usuario},${chave},'Lembrete de viagem',${'Solicitação #'+dados.codigo},'informacao','LEMBRETE',${dados.viagem})
        ON CONFLICT (usuario_id,chave) DO UPDATE SET titulo=EXCLUDED.titulo,lida_em=NULL
        WHERE public.notificacao.titulo='Lembrete desatualizado' RETURNING id`;
      total+=rows.length;
    }
    return total;
  });
}
