import { carregarAmbiente } from './config/environment.js';
import { registrarEvento } from './shared/logging/logger.js';

// Import dinâmico garante que nenhum módulo do pool seja avaliado antes da configuração.
carregarAmbiente();
try {
  const { createApp } = await import('./app.js');
  const { fecharBanco } = await import('./database/connection.js');
  const { iniciarLembretes } = await import('./modules/notificacoes/lembretes.service.js');
  const server = createApp();
  let encerrando = false;
  let pararLembretes: (() => Promise<void>) | undefined;
  const encerrar = () => {
    if (encerrando) return;
    encerrando = true;
    const paradaLembretes = pararLembretes?.() ?? Promise.resolve();
    const prazo = setTimeout(() => { server.closeAllConnections(); }, 5000);
    prazo.unref();
    server.close(() => {
      clearTimeout(prazo);
      void paradaLembretes.then(() => fecharBanco()).then(() => registrarEvento('server_stopped')).catch(() => { process.exitCode = 1; });
    });
  };
  server.on('error', () => {
    registrarEvento('startup_failed');
    process.exitCode = 1;
    void (pararLembretes?.() ?? Promise.resolve()).then(() => fecharBanco()).catch(() => { process.exitCode = 1; });
  });
  const listenHost = process.env.NODE_ENV === 'development'
    && process.env.FSPH_LOCAL_COMPOSE === '1' ? '0.0.0.0' : '127.0.0.1';
  server.listen(3000, listenHost, () => {
    try { pararLembretes = iniciarLembretes(); registrarEvento('server_started'); }
    catch { registrarEvento('startup_failed'); process.exitCode = 1; encerrar(); }
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, encerrar);
} catch {
  registrarEvento('startup_failed');
  process.exitCode = 1;
}
