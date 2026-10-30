import { afterEach, beforeEach, expect, test } from 'vitest';
import { SignJWT } from 'jose';
import { criarJwt, normalizarPerfil, validarJwt } from '../../src/security/jwt.js';

const segredoAnterior = process.env.JWT_SECRET;
const segredoTeste = 'segredo-de-autenticacao-teste-com-mais-de-32-bytes';

beforeEach(() => {
  process.env.JWT_SECRET = segredoTeste;
});

afterEach(() => {
  if (segredoAnterior === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoAnterior;
  }
});

test('emite e valida JWT com subject, expiração e perfil canônico', async () => {
  const token = await criarJwt({
    id: '42',
    email: 'gestor@example.test',
    perfil: 'GESTOR DA FROTA',
  });

  await expect(validarJwt(`Bearer ${token}`)).resolves.toEqual({
    id: '42',
    email: 'gestor@example.test',
    perfil: 'GESTOR_FROTA',
  });
});

test('rejeita token sem expiração e sem bearer', async () => {
  const tokenSemExpiracao = await new SignJWT({
    email: 'gestor@example.test',
    perfil: 'GESTOR_FROTA',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('42')
    .sign(new TextEncoder().encode(segredoTeste));

  await expect(validarJwt(`Bearer ${tokenSemExpiracao}`)).resolves.toBeNull();
  await expect(validarJwt(undefined)).resolves.toBeNull();
});

test('exige ao menos 32 bytes para o segredo e rejeita perfis desconhecidos', async () => {
  process.env.JWT_SECRET = 'curto';

  await expect(criarJwt({
    id: '42',
    email: 'gestor@example.test',
    perfil: 'GESTOR_FROTA',
  })).rejects.toThrow('JWT_SECRET deve conter pelo menos 32 bytes.');

  expect(normalizarPerfil('SUPERADMIN')).toBeNull();
});

test('rejeita segredo de 31 bytes e aceita 32 bytes UTF-8', async () => {
  process.env.JWT_SECRET = 'x'.repeat(31);
  await expect(criarJwt({ id: '42', perfil: 'ADM' })).rejects.toThrow();
  process.env.JWT_SECRET = '\u00e1'.repeat(16);
  const token = await criarJwt({ id: '42', perfil: 'ADM' });
  await expect(validarJwt(`Bearer ${token}`)).resolves.toMatchObject({ id: '42', perfil: 'ADM' });
});

test('rejeita assinatura, algoritmo, subject, expira??o e perfil inv?lidos', async () => {
  for (const scenario of [
    { alg: 'HS256', sub: '42', exp: '1h', perfil: 'ADM', key: 'outra-chave-artificial-com-32-bytes' },
    { alg: 'HS384', sub: '42', exp: '1h', perfil: 'ADM', key: segredoTeste },
    { alg: 'HS256', sub: '', exp: '1h', perfil: 'ADM', key: segredoTeste },
    { alg: 'HS256', sub: '42', exp: '-1h', perfil: 'ADM', key: segredoTeste },
    { alg: 'HS256', sub: '42', exp: '1h', perfil: 'SUPERADMIN', key: segredoTeste },
  ]) {
    const token = await new SignJWT({ perfil: scenario.perfil }).setProtectedHeader({ alg: scenario.alg })
      .setSubject(scenario.sub).setExpirationTime(scenario.exp).sign(new TextEncoder().encode(scenario.key));
    await expect(validarJwt(`Bearer ${token}`)).resolves.toBeNull();
  }
});
