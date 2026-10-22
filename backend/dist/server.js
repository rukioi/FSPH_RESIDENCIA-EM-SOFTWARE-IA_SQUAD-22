import { createApp } from './app.js';
const server = createApp();
server.on('error', (error) => {
    console.error('Não foi possível iniciar o servidor:', error.message);
    process.exitCode = 1;
});
server.listen(3000, '127.0.0.1', () => {
    console.log('Backend disponível em http://127.0.0.1:3000');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close());
}
