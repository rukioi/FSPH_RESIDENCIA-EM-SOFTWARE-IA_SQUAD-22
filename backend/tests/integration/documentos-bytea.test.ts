import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const server = createApp();
let veiculoId: string | undefined;
let endpoint: string;

beforeAll(async () => {
  const [veiculo] = await sql<{ id: string }[]>`
    INSERT INTO public.veiculo (placa, marca, modelo, ano, tipo)
    VALUES ('D9T0183', 'Fixture', 'Upload documental', 2026, 'PASSEIO')
    RETURNING id::text
  `;
  veiculoId = veiculo.id;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/documentos`;
});

afterAll(async () => {
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  try {
    if (veiculoId) {
      const id = veiculoId;
      const admin = await verifiedSql(true);
      try {
        await admin.begin(async tx => {
          await tx`DELETE FROM public.documento_historico
            WHERE documento_veiculo_id IN (SELECT id FROM public.documento_veiculo WHERE veiculo_id = ${id})`;
          await tx`DELETE FROM public.documento_veiculo WHERE veiculo_id = ${id}`;
          await tx`DELETE FROM public.veiculo WHERE id = ${id}`;
        });
      } finally {
        await admin.end();
      }
    }
  } finally {
    await sql.end();
    await fecharBanco();
  }
});

test('persiste os bytes originais do PDF enviado por multipart', async () => {
  const pdf = new Uint8Array([
    ...Buffer.from('%PDF-1.4\n', 'ascii'), 0, 127, 128, 255,
  ]);
  const token = await criarJwt({ id: '-27001', perfil: 'ADM' });
  const body = new FormData();
  body.append('veiculo_id', veiculoId!);
  body.append('tipo_documento', 'CRLV');
  body.append('data_vencimento', '2028-02-29');
  body.append('arquivo', new Blob([pdf], { type: 'application/pdf' }), 'fixture.pdf');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  expect(response.status).toBe(201);

  const [documento] = await sql<{ arquivo_dados: Buffer }[]>`
    SELECT arquivo_dados FROM public.documento_veiculo WHERE veiculo_id = ${veiculoId!}
  `;
  expect(documento?.arquivo_dados).toEqual(Buffer.from(pdf));
});
