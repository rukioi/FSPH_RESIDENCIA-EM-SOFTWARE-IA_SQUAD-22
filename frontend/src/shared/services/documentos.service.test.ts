import { afterEach, expect, test, vi } from 'vitest';
import { buscarDocumentos } from './documentos.service';

vi.mock('./auth.service', () => ({ fetchAutenticada: (...args: Parameters<typeof fetch>) => fetch(...args) }));
afterEach(() => vi.unstubAllGlobals());

test('preserva identificadores e aceita validade ausente da consulta legada', async () => {
  const dados = [{ id: '9007199254740993', tipo: 'CNH_MOTORISTA', descricao: 'CNH', relacionado_id: '2', data_validade: null, status: 'SEM_VALIDADE' }];
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: dados })));
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  expect(await buscarDocumentos(controller.signal)).toEqual(dados);
  expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
});

test('recusa resposta incompleta', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: '1' }] }))));
  await expect(buscarDocumentos()).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' });
});
