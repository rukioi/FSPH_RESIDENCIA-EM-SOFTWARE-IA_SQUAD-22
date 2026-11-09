import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const server = await createServer({
  root: resolve('.'), configFile: false, envDir: false, plugins: [react()],
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
});
await server.listen();
