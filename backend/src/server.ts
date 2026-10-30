import { carregarAmbiente } from './config/environment.js';
import { registrarEvento } from './shared/logging/logger.js';

// Import dinâmico garante que nenhum módulo do pool seja avaliado antes da configuração.
carregarAmbiente();
try {
  const { createApp } = await import('./app.js');
  const { fecharBanco } = await import('./database/connection.js');
  const server = createApp();
  let encerrando = false;
  const encerrar = () => {
    if (encerrando) return;
    encerrando = true;
    const prazo = setTimeout(() => { server.closeAllConnections(); }, 5000);
    prazo.unref();
    server.close(() => {
      clearTimeout(prazo);
      void fecharBanco().then(() => registrarEvento('server_stopped')).catch(() => { process.exitCode = 1; });
    });
  };
  server.on('error', () => {
    registrarEvento('startup_failed');
    process.exitCode = 1;
    void fecharBanco().catch(() => { process.exitCode = 1; });
  });
  server.listen(3000, '127.0.0.1', () => registrarEvento('server_started'));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, encerrar);
} catch {
  registrarEvento('startup_failed');
  process.exitCode = 1;
}
