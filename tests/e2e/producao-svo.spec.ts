import { expect, test } from '@playwright/test';
import { build, preview, type PreviewServer } from 'vite';
import { fileURLToPath } from 'node:url';

let servidor: PreviewServer;
let origem: string;
test.beforeAll(async ({ browserName }, info) => {
  const root = fileURLToPath(new URL('../../frontend/', import.meta.url));
  const config = { root, configFile: root + 'vite.config.ts', envDir: false as const,
    build: { outDir: info.outputPath('build-producao-' + browserName) }, logLevel: 'error' as const };
  await build(config);
  servidor = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
  const address = servidor.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Porta de preview não disponível.');
  origem = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (servidor) await new Promise<void>(resolve => servidor.httpServer.close(() => resolve())); });
for (const width of [390, 768, 1280]) test(`build de produção sem Google Fonts preserva login e proteção em ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const erros: string[] = [];
  const api: string[] = [];
  let fontesBloqueadas = 0;
  page.on('pageerror', e => erros.push(e.message));
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) api.push(req.url()); });
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => { fontesBloqueadas++; return route.abort('failed'); });
  for (const caminho of ['/login', '/svo/dashboard', '/svo-preview/dashboard']) {
    await page.goto(origem + caminho);
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    await expect(page).toHaveURL(origem + '/login');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(fontesBloqueadas).toBeGreaterThan(0);
  expect(erros).toEqual([]);
  expect(api).toEqual([]);
  await page.screenshot({ path: info.outputPath('login-sem-fontes.png'), fullPage: true });
});
