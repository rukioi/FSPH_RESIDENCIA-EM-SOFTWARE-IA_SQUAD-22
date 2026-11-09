import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { EventoAtividade } from '../auditoria/auditoria.service.js';
import { inserirNotificacao } from './notificacoes.repository.js';

/** Notifica destinatários dos eventos reais na mesma transação, sem dados sensíveis do SVO. */
export async function notificarAtividades(tx: postgres.TransactionSql, eventos: EventoAtividade[]) {
  for (const evento of eventos) {
    if (evento.operacao.startsWith('solicitacao_viagem_')) {
      const [pedido] = await tx`SELECT s.codigo,s.solicitante_id::text,m.usuario_id::text AS motorista
        FROM public.solicitacao_viagem s LEFT JOIN public.motorista m ON m.id=s.motorista_id WHERE s.id=${evento.recursoId}`;
      if (!pedido) continue;
      const gestao = await tx`SELECT id::text FROM public.usuario WHERE ativo=true AND perfil IN ('ADM','GESTOR_FROTA')`;
      const titulos: Record<string,string> = {
        solicitacao_viagem_criada:'Nova solicitação aguardando análise', solicitacao_viagem_editada:'Solicitação atualizada para análise',
        solicitacao_viagem_aprovada:'Solicitação aprovada', solicitacao_viagem_reprovada:'Solicitação recusada',
        solicitacao_viagem_agendada:'Viagem agendada', solicitacao_viagem_reagendada:'Viagem reagendada',
      };
      const titulo = titulos[evento.operacao];
      if (!titulo) continue;
      const atribuicao = ['solicitacao_viagem_agendada','solicitacao_viagem_reagendada'].includes(evento.operacao);
      const usuarios = new Set(gestao.map(u=>String(u.id)));
      if (pedido.solicitante_id) usuarios.add(pedido.solicitante_id);
      if (atribuicao && pedido.motorista) usuarios.add(pedido.motorista);
      await inserirNotificacao(tx,[...usuarios],randomUUID(),titulo,`Solicitação #${pedido.codigo}`,
        evento.operacao === 'solicitacao_viagem_reprovada' ? 'atencao' : atribuicao || evento.operacao === 'solicitacao_viagem_aprovada' ? 'sucesso' : 'informacao');
    }
    if (['ordem_despachada','ordem_cancelada'].includes(evento.operacao)) {
      const [ordem] = await tx`SELECT m.usuario_id::text FROM public.ordem_coleta o JOIN public.motorista m ON m.id=o.motorista_id WHERE o.id=${evento.recursoId}`;
      if (ordem?.usuario_id) await inserirNotificacao(tx,[ordem.usuario_id],randomUUID(),
        evento.operacao === 'ordem_despachada' ? 'Nova demanda atribuída a você' : 'Demanda cancelada',
        `Ordem de coleta #OC-${evento.recursoId}`, 'informacao');
    }
  }
}
