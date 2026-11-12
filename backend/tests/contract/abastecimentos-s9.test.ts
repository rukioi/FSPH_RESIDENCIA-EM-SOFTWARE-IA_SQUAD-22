import { expect, test } from 'vitest';
import { openapi } from '../../src/shared/contract/openapi.js';
import { abastecimentosSchemas } from '../../src/modules/abastecimentos/abastecimentos.schemas.js';
import type { ApiSchemas } from '../../../frontend/src/shared/api/generated/schema.js';

test('contrato do comprovante publica upload compartilhado e amplia download preservando JPEG/PNG', () => {
  const doc = openapi();
  const path = doc.paths['/api/abastecimentos/{id}/comprovante'];
  expect(path.get).toMatchObject({ security: [{ bearerAuth: [] }], 'x-perfis': ['ADM', 'GESTOR_FROTA'],
    responses: { 200: { content: {
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    } }, 401: {}, 403: {}, 404: {}, 500: {} } });
  expect(path.post).toMatchObject({ security:[{bearerAuth:[]}], 'x-perfis':['ADM','GESTOR_FROTA'],
    requestBody:{content:{'multipart/form-data':{schema:{required:['arquivo'],additionalProperties:false}}}},
    responses:{201:{},400:{},401:{},403:{},404:{},413:{},415:{},500:{}} });
  expect(doc.paths['/api/abastecimentos'].post).toMatchObject({
    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CriarAbastecimentoRF40' } } } },
    responses: { 201: {}, 400: {}, 401: {}, 403: {}, 404: {}, 409: {}, 413: {}, 415: {}, 500: {} },
  });
});

test('DTO legado admite somente os tipos de arquivo já existentes e não inventa metadados', () => {
  const input: ApiSchemas['CriarAbastecimentoRF40'] = { veiculo_id: '1', data_abastecimento: '2026-08-10',
    litragem: '1.00', valor_total: '5.00', comprovante: { nome: 'foto.png', tipo: 'image/png', dadosBase64: 'iVBORw0KGgo=' } };
  expect(abastecimentosSchemas.CriarAbastecimentoRF40.safeParse(input).success).toBe(true);
  expect(abastecimentosSchemas.CriarAbastecimentoRF40.safeParse({ ...input,
    comprovante: { ...input.comprovante, tipo: 'application/pdf' } }).success).toBe(false);
  expect(openapi().components.schemas.DetalheAbastecimento).toMatchObject({ properties: { comprovante_nome: {} } });
  expect(openapi().components.schemas.DetalheAbastecimento.properties).not.toHaveProperty('urlPublica');
});

test('indicadores publicam filtros e erros atuais sem paginação ou acesso de perfil SVO', () => {
  expect(openapi().paths['/api/abastecimentos/indicadores'].get).toMatchObject({
    security: [{ bearerAuth: [] }], 'x-perfis': ['ADM', 'GESTOR_FROTA'], 'x-runtime-validation': true,
    parameters: [{ name: 'veiculoId' }, { name: 'inicio' }, { name: 'fim' }],
    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/IndicadoresAbastecimentos' } } } },
      400: {}, 401: {}, 403: {}, 404: {}, 500: {} },
  });
});

const observado: ApiSchemas['IndicadoresAbastecimentos'] = { data: {
  estado: 'DISPONIVEL', quantidade: 1, totalLitros: '0.10', totalCusto: '0.30', custoPorLitro: '3.0000',
  periodoObservado: { inicio: '2026-08-10', fim: '2026-08-10' },
  kmObservadosPorVeiculo: [{ veiculoId: '9007199254740993', leiturasComKm: 0, leiturasSemKm: 1, menorKm: null, maiorKm: null }],
  consumoPorDistancia: { valor: null, estado: 'INDISPONIVEL', motivo: 'REGRA_DE_NEGOCIO_PENDENTE' },
} };

test('DTO gerado e schema preservam NUMERIC/BIGINT como strings e ausência como null', () => {
  expect(abastecimentosSchemas.IndicadoresAbastecimentos.parse(observado)).toEqual(observado);
  for (const campo of ['totalLitros', 'totalCusto', 'custoPorLitro']) {
    expect(abastecimentosSchemas.IndicadoresAbastecimentos.safeParse({ data: { ...observado.data, [campo]: 0.3 } }).success).toBe(false);
  }
  const vazio: ApiSchemas['IndicadoresAbastecimentos'] = { data: { ...observado.data,
    estado: 'SEM_ABASTECIMENTOS', quantidade: 0, totalLitros: '0.00', totalCusto: '0.00', custoPorLitro: null,
    periodoObservado: { inicio: null, fim: null }, kmObservadosPorVeiculo: [],
  } };
  expect(abastecimentosSchemas.IndicadoresAbastecimentos.parse(vazio)).toEqual(vazio);
});

test('contrato recusa consumo por distância numérico ou disponibilidade fabricada', () => {
  for (const consumo of [{ ...observado.data.consumoPorDistancia, valor: 0 },
    { ...observado.data.consumoPorDistancia, estado: 'DISPONIVEL' }]) {
    expect(abastecimentosSchemas.IndicadoresAbastecimentos.safeParse({ data: { ...observado.data, consumoPorDistancia: consumo } }).success).toBe(false);
  }
});
