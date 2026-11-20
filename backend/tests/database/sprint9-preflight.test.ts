
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;

beforeAll(async () => {
  sql = await verifiedSql();
});

afterAll(async () => {
  await sql?.end();
});

test('preflight executa dentro de transacao somente leitura e preserva os dados', async () => {
  const lerConsultas = (nome: string) =>
    readFileSync(resolve(root, 'backend/src/database/scripts', nome), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

  await sql.begin('isolation level repeatable read read only', async tx => {
    const [modo] = await tx`
      SELECT current_setting('transaction_read_only') AS leitura
    `;
    expect(modo.leitura).toBe('on');

    const catalogo = [];
    for (const consulta of lerConsultas('inspect-s9-catalog.sql')) {
      catalogo.push(await tx.unsafe(consulta));
    }

    expect(catalogo).toHaveLength(5);

    for (const tabela of ['abastecimento', 'veiculo', 'motorista']) {
      expect(catalogo[0].find(r => r.nome === tabela)).toMatchObject({
        existe: true,
      });
    }

    expect(catalogo[1].length).toBeGreaterThan(0);
    expect(catalogo[1].every(r => r.resultado === 'COMPATIVEL')).toBe(true);
    expect(
      catalogo[2].some(
        r => r.tabela === 'abastecimento' && r.coluna === 'quilometragem'
      )
    ).toBe(true);

    const [antes] = await tx`
      SELECT
        (SELECT count(*) FROM public.abastecimento) AS abastecimentos,
        (SELECT count(*) FROM public.veiculo) AS veiculos,
        (SELECT count(*) FROM public.motorista) AS motoristas
    `;

    const dados = [];
    for (const consulta of lerConsultas('inspect-s9-data.sql')) {
      dados.push(await tx.unsafe(consulta));
    }

    const [depois] = await tx`
      SELECT
        (SELECT count(*) FROM public.abastecimento) AS abastecimentos,
        (SELECT count(*) FROM public.veiculo) AS veiculos,
        (SELECT count(*) FROM public.motorista) AS motoristas
    `;

    expect(depois).toEqual(antes);
    expect(dados).toHaveLength(1);
    expect(dados[0][0]).toHaveProperty('quilometragens_negativas');
    expect(dados[0][0]).toHaveProperty('veiculos_com_marcador_svo');
  });
});

test('contagens identificam dados ficticios sem alterar tabelas publicas', async () => {
  const [antes] = await sql`
    SELECT
      (SELECT count(*) FROM public.abastecimento) AS abastecimentos,
      (SELECT count(*) FROM public.veiculo) AS veiculos,
      (SELECT count(*) FROM public.motorista) AS motoristas
  `;

  await sql.unsafe(
    'CREATE TEMP TABLE s9_pf_veiculo (id bigint, is_svo boolean, tipo text) ON COMMIT PRESERVE ROWS'
  );
  await sql.unsafe(
    'CREATE TEMP TABLE s9_pf_motorista (id bigint) ON COMMIT PRESERVE ROWS'
  );
  await sql.unsafe(
    'CREATE TEMP TABLE s9_pf_abastecimento (veiculo_id bigint, motorista_id bigint, quilometragem integer, litragem numeric(10,2), valor_total numeric(10,2)) ON COMMIT PRESERVE ROWS'
  );

  await sql`
    INSERT INTO pg_temp.s9_pf_veiculo (id, is_svo, tipo)
    VALUES
      (101, false, 'PASSEIO'),
      (102, true, 'RABECÃO_SVO'),
      (103, false, 'RABECÃO_SVO')
  `;

  await sql`
    INSERT INTO pg_temp.s9_pf_motorista (id)
    VALUES (201)
  `;

  await sql`
    INSERT INTO pg_temp.s9_pf_abastecimento
      (veiculo_id, motorista_id, quilometragem, litragem, valor_total)
    VALUES
      (101, 201, 100, 20, 100),
      (101, 201, -1, 0, 0),
      (102, NULL, NULL, -2, -3),
      (103, 201, 200, 'NaN'::numeric, 'NaN'::numeric),
      (999, 201, 300, NULL, NULL),
      (NULL, 999, 500, 5, 5),
      (101, 201, 0, 2, 3)
  `;

  const original = readFileSync(
    resolve(root, 'backend/src/database/scripts/inspect-s9-data.sql'),
    'utf8'
  );

  const partes = [
    ['FROM public.abastecimento a', 'FROM pg_temp.s9_pf_abastecimento a'],
    ['JOIN public.veiculo v', 'JOIN pg_temp.s9_pf_veiculo v'],
    ['JOIN public.motorista m', 'JOIN pg_temp.s9_pf_motorista m'],
  ] as const;

  let consulta = original;

  for (const [antesTexto, depoisTexto] of partes) {
    expect(consulta.split(antesTexto)).toHaveLength(2);
    consulta = consulta.replace(antesTexto, depoisTexto);
  }

  await sql.begin('isolation level repeatable read read only', async tx => {
    const [modo] = await tx`
      SELECT current_setting('transaction_read_only') AS leitura
    `;
    expect(modo.leitura).toBe('on');

    const [resultado] = await tx.unsafe(consulta);

    expect(resultado).toMatchObject({
      total: '7',
      sem_motorista: '1',
      sem_quilometragem: '1',
      litros_nulos: '1',
      litros_invalidos: '3',
      valores_nulos: '1',
      valores_invalidos: '3',
      quilometragens_negativas: '1',
      sem_veiculo: '1',
      veiculo_inexistente: '1',
      motorista_inexistente: '1',
      veiculos_com_marcador_svo: '1',
      veiculos_tipo_svo: '2',
    });
  });

  const [depois] = await sql`
    SELECT
      (SELECT count(*) FROM public.abastecimento) AS abastecimentos,
      (SELECT count(*) FROM public.veiculo) AS veiculos,
      (SELECT count(*) FROM public.motorista) AS motoristas
  `;

  expect(depois).toEqual(antes);
  // As tabelas temporarias pertencem exclusivamente a esta sessao
  // e sao removidas ao fechar o pool no afterAll.
});

test('SQL original identifica registros legados permitidos e remove somente as fixtures', async () => {
  const ids = {
    motorista: '-93700101',
    normal: '-93700201',
    svo: '-93700202',
    abastecimentos: [
      '-93700301',
      '-93700302',
      '-93700303',
      '-93700304',
    ],
  };

  const ler = (nome: string) =>
    readFileSync(resolve(root, 'backend/src/database/scripts', nome), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

  const consultar = async () =>
    sql.begin('isolation level repeatable read read only', async tx => {
      const catalogo = [];

      for (const consulta of ler('inspect-s9-catalog.sql')) {
        catalogo.push(await tx.unsafe(consulta));
      }

      expect(catalogo[1].length).toBeGreaterThan(0);
      expect(catalogo[1].every(r => r.resultado === 'COMPATIVEL')).toBe(true);

      const [modo] = await tx`
        SELECT current_setting('transaction_read_only') AS leitura
      `;
      expect(modo.leitura).toBe('on');

      const [resultado] = await tx.unsafe(ler('inspect-s9-data.sql')[0]);
      return resultado;
    });

  const antes = await consultar();
  let criado = false;

  // RF40: confirmar a nulabilidade antes de inserir fixtures legadas.
  // Se o banco isolado estiver desatualizado, falhar com mensagem clara.
  const colunas = await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'abastecimento'
      AND column_name IN ('motorista_id', 'quilometragem')
  `;

  for (const coluna of ['motorista_id', 'quilometragem']) {
    const encontrada = colunas.find(c => c.column_name === coluna);

    expect(
      encontrada?.is_nullable,
      `Banco isolado desatualizado: public.abastecimento.${coluna} deve permitir NULL. Verifique as migrations RF40 antes de executar as fixtures.`
    ).toBe('YES');
  }

  try {
    await sql.begin(async tx => {
      await tx`
        INSERT INTO public.motorista
          (id, nome, cnh, categoria_cnh, validade_cnh)
        VALUES
          (${ids.motorista}, 'Fixture SCRUM-179', 'S9-PREFLIGHT-179', 'B', '2030-01-01')
      `;

      await tx`
        INSERT INTO public.veiculo
          (id, placa, modelo, marca, ano, tipo, is_svo)
        VALUES
          (${ids.normal}, 'S9PF001', 'Fixture', 'Fixture', 2026, 'PASSEIO', false),
          (${ids.svo}, 'S9PF002', 'Fixture', 'Fixture', 2026, 'RABECÃO_SVO', true)
      `;

      await tx`
        INSERT INTO public.abastecimento
          (id, veiculo_id, motorista_id, quilometragem, litragem, valor_total, data_abastecimento)
        VALUES
          (${ids.abastecimentos[0]}, ${ids.normal}, NULL, NULL, 10, 60, '2026-01-01'),
          (${ids.abastecimentos[1]}, ${ids.svo}, ${ids.motorista}, 0, 10, 60, '2026-01-01'),
          (${ids.abastecimentos[2]}, ${ids.svo}, ${ids.motorista}, 100, 10, 60, '2026-01-01'),
          (${ids.abastecimentos[3]}, ${ids.normal}, ${ids.motorista}, 200, 10, 60, '2026-01-01')
      `;
    });

    criado = true;

    const atual = await consultar();

    for (const [campo, diferenca] of Object.entries({
      total: 4,
      sem_motorista: 1,
      sem_quilometragem: 1,
      litros_invalidos: 0,
      valores_invalidos: 0,
      quilometragens_negativas: 0,
      veiculos_com_marcador_svo: 2,
      veiculos_tipo_svo: 2,
    })) {
      expect(Number(atual[campo]) - Number(antes[campo])).toBe(diferenca);
    }
  } finally {
    if (criado) {
      await sql.begin(async tx => {
        await tx`
          DELETE FROM public.abastecimento
          WHERE id = ANY(${ids.abastecimentos}::bigint[])
        `;

        await tx`
          DELETE FROM public.veiculo
          WHERE id IN (${ids.normal}, ${ids.svo})
        `;

        await tx`
          DELETE FROM public.motorista
          WHERE id = ${ids.motorista}
        `;
      });
    }
  }

  const depois = await consultar();
  expect(depois).toEqual(antes);
});
