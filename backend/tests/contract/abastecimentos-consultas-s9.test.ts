
import { expect, expectTypeOf, test } from 'vitest';
import { openapi } from '../../src/shared/contract/openapi.js';
import { abastecimentosSchemas } from '../../src/modules/abastecimentos/abastecimentos.schemas.js';
import type { ApiOperations } from '../../../frontend/src/shared/api/generated/schema.js';

test('litros e valor positivos são validados no contrato sem converter strings monetárias', () => {
  for (const campo of ['litragem', 'valor_total'] as const) {
    const schema = abastecimentosSchemas.CriarAbastecimento.shape[campo];

    for (const valor of [0, '0', -1, '-1', '', ' ', null, 'Infinity', Infinity]) {
      expect(schema.safeParse(valor).success).toBe(false);
    }

    expect(schema.parse('10.50')).toBe('10.50');
    expect(schema.parse(10.5)).toBe(10.5);
  }
});

test('motorista é opcional no cadastro, OpenAPI e DTO', () => {
  const entrada = {
    veiculo_id: 1,
    litragem: 10,
    valor_total: 60,
    quilometragem: 1000,
    data_abastecimento: '2026-11-18',
  };

  for (const motorista_id of [undefined, null]) {
    expect(
      abastecimentosSchemas.CriarAbastecimento.safeParse({
        ...entrada,
        motorista_id,
      }).success
    ).toBe(true);
  }

  expect(
    abastecimentosSchemas.CriarAbastecimento.parse({
      ...entrada,
      motorista_id: '2',
    }).motorista_id
  ).toBe('2');

  const contrato = openapi().components.schemas.CriarAbastecimento;

  expect(contrato.required).not.toContain('motorista_id');
  expect(contrato.properties?.motorista_id).toMatchObject({
    anyOf: [expect.any(Object), { type: 'null' }],
  });

  expectTypeOf<
    ApiOperations['abastecimentos_post__api_abastecimentos']['body']['motorista_id']
  >().toEqualTypeOf<number | string | null | undefined>();
});

test.each([
  0,
  -1,
  0.001,
  0.004,
  0.005,
  0.009,
  1.234,
  10.999,
  '0.001',
  '0.005',
  '0.009',
  '1.234',
  '10.999',
  '5e-3',
  '0.004999999999999999999',
  '4.999999999999999999e-3',
])(
  'RF40 rejeita valor não positivo ou com precisão superior a duas casas: %s',
  valor => {
    for (const campo of ['litragem', 'valor_total'] as const) {
      const schema = abastecimentosSchemas.CriarAbastecimento.shape[campo];

      expect(schema.safeParse(valor).success).toBe(false);
      expect(schema.safeParse(String(valor)).success).toBe(false);
    }
  }
);

test.each([
  0.01,
  10.5,
  10,
  '10.50',
  '99999999.99',
])(
  'preserva valor representável positivo sem arredondamento em JavaScript: %s',
  valor => {
    for (const campo of ['litragem', 'valor_total'] as const) {
      const schema = abastecimentosSchemas.CriarAbastecimento.shape[campo];

      expect(schema.parse(valor)).toBe(valor);
    }
  }
);

test('RF40: km é opcional, inteiro não negativo quando informado', () => {
  const entrada = {
    veiculo_id: 1,
    motorista_id: 1,
    litragem: 10,
    valor_total: 60,
    data_abastecimento: '2026-11-18',
  };

  const schema = abastecimentosSchemas.CriarAbastecimento;

  for (const km of [-1, -2147483648, 1.5]) {
    expect(
      schema.safeParse({
        ...entrada,
        quilometragem: km,
      }).success
    ).toBe(false);
  }

  for (const km of [undefined, null]) {
    expect(
      schema.safeParse({
        ...entrada,
        quilometragem: km,
      }).success
    ).toBe(true);
  }

  expect(
    schema.safeParse({
      ...entrada,
      quilometragem: 1000,
    }).success
  ).toBe(true);

  expect(
    schema.safeParse({
      ...entrada,
      quilometragem: 0,
    }).success
  ).toBe(true);

  const contrato = openapi().components.schemas.CriarAbastecimento;

  expect(contrato.required).not.toContain('quilometragem');

  expect(contrato.properties?.quilometragem).toMatchObject({
    anyOf: [
      { type: 'integer', minimum: 0 },
      { type: 'null' },
    ],
  });

  expectTypeOf<
    ApiOperations['abastecimentos_post__api_abastecimentos']['body']['quilometragem']
  >().toEqualTypeOf<number | null | undefined>();
});

test('consultas novas publicam autorização e erros, sem alterar cadastro/km/indicadores da main', () => {
  const doc = openapi();

  for (const path of [
    '/api/abastecimentos',
    '/api/abastecimentos/{id}',
    '/api/veiculos/{id}/abastecimentos',
  ]) {
    expect(doc.paths[path].get).toMatchObject({
      security: [{ bearerAuth: [] }],
      'x-perfis': ['ADM', 'GESTOR_FROTA'],
      'x-runtime-validation': true,
      responses: {
        200: {},
        400: {},
        401: {},
        403: {},
        404: {},
        500: {},
      },
    });
  }

  expect(
    abastecimentosSchemas.DetalheAbastecimento.shape.quilometragem
      .safeParse(null).success
  ).toBe(true);

  expect(doc.paths['/api/abastecimentos'].post).toMatchObject({
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/CriarAbastecimento',
          },
        },
      },
    },
    responses: {
      409: {},
    },
  });
});

test('comprovante usa multipart estrito sem vínculo fornecido pelo formulário e download binário privado', () => {
  const path = openapi().paths['/api/abastecimentos/{id}/comprovante'];

  expect(path.post).toMatchObject({
    'x-perfis': ['ADM', 'GESTOR_FROTA'],
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: {
            additionalProperties: false,
            required: ['arquivo'],
            properties: {
              arquivo: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
      },
    },
    responses: {
      201: {},
      400: {},
      401: {},
      403: {},
      404: {},
      413: {},
      415: {},
      500: {},
    },
  });

  expect(path.get).toMatchObject({
    responses: {
      200: {
        content: {
          'application/pdf': {},
          'image/jpeg': {},
          'image/png': {},
        },
      },
    },
  });

  const body: ApiOperations['abastecimentos_post__api_abastecimentos_id_comprovante']['body'] =
    new FormData();

  expect(body).toBeInstanceOf(FormData);
});
