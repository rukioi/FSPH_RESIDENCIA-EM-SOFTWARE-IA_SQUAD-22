import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { enviarErro, enviarJson } from '../backend/src/shared/http/json.js';

import { registrarFalha } from '../backend/src/shared/logging/logger.js';

let app: Promise<Server> | undefined;

/** Entrada Vercel: reutiliza as rotas node:http sem abrir porta nem carregar arquivos de ambiente. */
export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    if (request.url?.split('?', 1)[0] === '/api/cron/manutencao-alertas') {
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        enviarErro(response, 405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
        return;
      }
      const segredo = process.env.CRON_SECRET;
      const autorizacao = request.headers.authorization;
      const hash = (valor: string) => createHash('sha256').update(valor).digest();
      if (!segredo || segredo.length < 16 || !autorizacao ||
          !timingSafeEqual(hash(autorizacao), hash('Bearer ' + segredo))) {
        enviarErro(response, 401, 'NAO_AUTENTICADO', 'Autenticação necessária.');
        return;
      }
      if (process.env.MANUTENCAO_ALERTAS_ATIVOS !== 'true') {
        response.statusCode = 204;
        response.end();
        return;
      }
      try {
        const { processarAlertasManutencao } = await import('../backend/src/modules/manutencoes/manutencoes.alertas.js');
        const resultado = await processarAlertasManutencao();
        const parcial = resultado.falhas > 0 || resultado.adiadas > 0 || resultado.restantes;
        enviarJson(response, parcial ? 503 : 200, resultado);
      } catch (erro) {
        registrarFalha(erro);
        enviarErro(response, 500, 'ERRO_INTERNO', 'Não foi possível executar o emissor de manutenção.');
      }
      return;
    }
    app ??= import('../backend/src/app.js').then(({ createApp }) => createApp());
    const server = await app;
    await new Promise<void>(resolve => {
      response.once('finish', resolve);
      response.once('close', resolve);
      server.emit('request', request, response);
    });
  } catch {
    app = undefined;
    enviarErro(response, 500, 'ERRO_INTERNO', 'O serviço está indisponível. Tente novamente mais tarde.');
  }
}
