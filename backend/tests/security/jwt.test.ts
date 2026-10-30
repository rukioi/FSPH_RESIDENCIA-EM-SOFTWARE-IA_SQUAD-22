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

test('exige ao menos 16 bytes para o segredo e rejeita perfis desconhecidos', async () => {
  process.env.JWT_SECRET = 'curto';

  await expect(criarJwt({
    id: '42',
    email: 'gestor@example.test',
    perfil: 'GESTOR_FROTA',
  })).rejects.toThrow('JWT_SECRET deve conter pelo menos 16 bytes.');

  expect(normalizarPerfil('SUPERADMIN')).toBeNull();
});

test('emite JWT com segredo de 16 bytes', async () => {
  process.env.JWT_SECRET = '1234567890abcdef';

  const token = await criarJwt({
    id: '42',
    email: 'gestor@example.test',
    perfil: 'GESTOR_FROTA',
  });

  await expect(validarJwt(`Bearer ${token}`)).resolves.toMatchObject({
    id: '42',
    perfil: 'GESTOR_FROTA',
  });
});