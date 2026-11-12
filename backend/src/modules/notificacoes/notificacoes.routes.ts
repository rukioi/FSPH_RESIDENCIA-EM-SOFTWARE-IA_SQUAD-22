import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { enviarErro, enviarJson } from '../../shared/http/json.js';
import { consultaNotificacoes, notificacoesSchemas } from './notificacoes.schemas.js';
import { consultarCaixa, marcarLeitura, sincronizarVencimentos } from './notificacoes.repository.js';

/** A identidade vem da sessão atual; nunca aceita destinatário no corpo ou na query. */
export async function notificacoesRoute(req: IncomingMessage, res: ServerResponse) {
  const usuario = await autenticarRequisicao(req,res);
  if (!usuario) return;
  const url = new URL(req.url ?? '', 'http://localhost');
  const rotaMotorista = url.pathname.startsWith('/api/motorista/notificacoes');
  if (rotaMotorista && !autorizarPerfis(usuario,['MOTORISTA'],res)) return;
  req.resume();
  if (req.method === 'GET') {
    if ([...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1)) {
      enviarErro(res,400,'ENTRADA_INVALIDA','Confira os filtros informados.'); return;
    }
    const filtros=Object.fromEntries(url.searchParams);
    if (rotaMotorista && (Object.keys(filtros).some(k=>!['pagina','lida'].includes(k)) || (filtros.lida!==undefined && !['true','false'].includes(filtros.lida)))) {
      enviarErro(res,400,'ENTRADA_INVALIDA','Confira os filtros informados.'); return;
    }
    const consulta = consultaNotificacoes.safeParse(rotaMotorista ? {page:filtros.pagina,filtro:filtros.lida===undefined?'todas':filtros.lida==='true'?'lidas':'nao-lidas'} : filtros);
    if (!consulta.success) { enviarErro(res,400,'ENTRADA_INVALIDA','Confira os filtros informados.'); return; }
    enviarJson(res,200,notificacoesSchemas.ListaNotificacoes.parse(await consultarCaixa(usuario.id,consulta.data)));
    return;
  }
  if (url.pathname.endsWith('/sincronizar')) {
    enviarJson(res,200,notificacoesSchemas.NotificacoesAtualizadas.parse({data:{atualizadas:await sincronizarVencimentos(usuario.id)}})); return;
  }
  const id = url.pathname.match(/\/([0-9]+)\/(?:ler|lida)$/)?.[1];
  if (id && (BigInt(id)>9223372036854775807n || BigInt(id)<1n)) {
    enviarErro(res,400,'ENTRADA_INVALIDA','Identificador inválido.'); return;
  }
  const atualizadas = await marcarLeitura(usuario.id,id);
  if (id && !atualizadas) { enviarErro(res,404,'NAO_ENCONTRADO','Notificação não encontrada.'); return; }
  enviarJson(res,200,notificacoesSchemas.NotificacoesAtualizadas.parse({data:{atualizadas}}));
}
