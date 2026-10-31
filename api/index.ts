import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { enviarErro } from '../backend/src/shared/http/json.js';

let app: Promise<Server> | undefined;

/** Entrada Vercel: reutiliza as rotas node:http sem abrir porta nem carregar arquivos de ambiente. */
export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
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
