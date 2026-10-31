import { afterEach, expect, test, vi } from 'vitest';
import { entrar } from './auth.service';

afterEach(() => vi.unstubAllGlobals());

test('login normaliza o 404 textual da Vercel sem salvar sessão', async () => {
  const setItem = vi.fn();
  vi.stubGlobal('sessionStorage', { setItem });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('The page could not be found', { status: 404 })));
  await expect(entrar({ email: 'fixture@example.invalid', senha: 'fixture' })).rejects.toMatchObject({
    status: 404, code: 'HTTP_404', message: 'O serviço solicitado não foi encontrado. Tente novamente mais tarde.',
  });
  expect(setItem).not.toHaveBeenCalled();
});

test('login valida o usuário antes de persistir o token', async () => {
  const setItem = vi.fn();
  vi.stubGlobal('sessionStorage', { setItem });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'fixture', usuario: {} }))));
  await expect(entrar({ email: 'fixture@example.invalid', senha: 'fixture' })).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' });
  expect(setItem).not.toHaveBeenCalled();
});
