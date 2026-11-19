import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { enviarJson } from '../../shared/http/json.js';
import { gerarRelatorio, validarConsultaRelatorio } from './relatorios.service.js';
import { consultarRecursosRelatorios } from './relatorios.repository.js';
import { respostaRecursosRelatoriosSchema } from './relatorios.schemas.js';
import { ErroHttp } from '../../shared/http/errors.js';

/** Aplica autorização por módulo antes de consultas, recursos e dados exportáveis. */
export async function relatoriosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const svo = url.pathname.startsWith('/api/svo/');
  const usuario = await autenticarRequisicao(req, res);
  if (!usuario || !autorizarPerfis(usuario, svo ? ['ATENDENTE_SVO'] : ['ADM', 'GESTOR_FROTA'], res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname.endsWith('/recursos')) {
    if (url.search) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'A consulta de filtros não aceita parâmetros.');
    enviarJson(res, 200, respostaRecursosRelatoriosSchema.parse({data: await consultarRecursosRelatorios()}));
  } else enviarJson(res, 200, await gerarRelatorio(validarConsultaRelatorio(url.searchParams, svo)));
}
