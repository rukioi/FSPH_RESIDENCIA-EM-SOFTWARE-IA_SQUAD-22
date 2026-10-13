import { createServer } from 'node:http';

export function createApp() {
  return createServer((_request, response) => {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Não encontrado.');
  });
}
