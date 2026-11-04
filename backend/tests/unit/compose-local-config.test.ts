import { expect, test } from 'vitest';
import { configurarBanco } from '../../src/config/environment.js';

const url = 'postgres://fsph_compose_app:fixture@db:5432/fsph_compose_dev';

test('Compose local permite PostgreSQL sem TLS apenas com confirmação explícita', () => {
  expect(configurarBanco({
    NODE_ENV: 'development', FSPH_LOCAL_COMPOSE: '1', DB_TLS: 'disable', DATABASE_URL: url,
  }).ssl).toBe(false);
});

test('fora do modo de desenvolvimento, host Docker não dispensa TLS', () => {
  expect(() => configurarBanco({
    NODE_ENV: 'production', FSPH_LOCAL_COMPOSE: '1', DB_TLS: 'disable', DATABASE_URL: url,
  })).toThrow('Configuração TLS do banco inválida.');
});

test('flag local não autoriza TLS desabilitado para banco externo', () => {
  expect(() => configurarBanco({
    NODE_ENV: 'development', FSPH_LOCAL_COMPOSE: '1', DB_TLS: 'disable',
    DATABASE_URL: 'postgres://user:fixture@db.exemplo.net:5432/fsph_compose_dev',
  })).toThrow('Configuração TLS do banco inválida.');
});

test('flag local exige banco, host e porta exatos', () => {
  expect(() => configurarBanco({
    NODE_ENV: 'development', FSPH_LOCAL_COMPOSE: '1', DB_TLS: 'disable',
    DATABASE_URL: 'postgres://user:fixture@db:5433/outro_banco',
  })).toThrow('Configuração TLS do banco inválida.');
});
