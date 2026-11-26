import { createHash } from 'node:crypto';
import { expect } from 'vitest';

export async function verificarDownloadPrivado(response: Response, bytes: Buffer, tipo: string, nome: string) {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(tipo);
  expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${nome}"`);
  expect(response.headers.get('content-length')).toBe(String(bytes.length));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('location')).toBeNull();
  expect(response.redirected).toBe(false);
  const recebido = Buffer.from(await response.arrayBuffer());
  expect(recebido).toEqual(bytes);
  expect(createHash('sha256').update(recebido).digest('hex')).toBe(createHash('sha256').update(bytes).digest('hex'));
}
