import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { canonical, metadataQuery, type Metadata } from '../../src/database/scripts/generate-db-docs.js';

// DB-S8-01 (SCRUM-166): provas reais no PostgreSQL isolado. Usa somente fixtures
// artificiais do seed e IDs próprios (-28xxx); escritas confirmadas são removidas.
type Sql = Awaited<ReturnType<typeof verifiedSql>>;
type Tx = postgres.TransactionSql;
let sql: Sql, outra: Sql, admin: Sql;
beforeAll(async () => { [sql, outra, admin] = [await verifiedSql(), await verifiedSql(), await verifiedSql(true)]; });
afterAll(async () => { await Promise.all([sql?.end(), outra?.end(), admin?.end()]); });

const migration = readFileSync(resolve(root,
  'backend/src/database/supabase/migrations/20261109200000_db_s8_01_viagem_execucao.sql'), 'utf8');
const reversao = readFileSync(resolve(root,
  'backend/src/database/rollback/20261109200000_db_s8_01_viagem_execucao.down.sql'), 'utf8');
const preflight = readFileSync(resolve(root, 'backend/src/database/scripts/inspect-db-s8-01.sql'), 'utf8')
  .split(';').map(s => s.trim()).filter(s => s.replace(/--.*$/gm, '').trim());
const desfazer = new Error('rollback deliberado DB-S8-01');
const GESTOR = -27002, SOLICITANTE = -27003, USUARIO_MOTORISTA = -27004;
const MOTORISTA = -27001, VEICULO = -27001;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);

/** Solicitação agendada e viagem nova vinculada 1:1, dentro da transação recebida. */
async function cenario(tx: Tx, id: number) {
  await tx`insert into public.solicitacao_viagem
    (id, codigo, solicitante_id, origem, destino, data_hora_saida, status, veiculo_id, motorista_id, finalidade)
    values (${id}, ${'S8T' + Math.abs(id)}, ${SOLICITANTE}, 'Origem de teste', 'Destino de teste',
      '2026-11-10 08:00:00', 'AGENDADA', ${VEICULO}, ${MOTORISTA}, 'Teste DB-S8-01')`;
  const [viagem] = await tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
    values (${id}, ${id}, ${VEICULO}, ${MOTORISTA})
    returning id::int, status::text, criado_em, validada_por_gestor`;
  return viagem;
}

/** Executa a operação após o cenário e devolve o erro PostgreSQL; nada é confirmado. */
async function erroDe(operacao: (tx: Tx) => Promise<unknown>, conn: Sql = sql) {
  return conn.begin(async tx => { await cenario(tx, -28101); await operacao(tx); throw desfazer; })
    .then(() => null, (error: unknown) => error);
}

async function metadados(conn: Sql | Tx) {
  const [row] = await conn.unsafe(metadataQuery);
  return canonical(row.metadata as Metadata);
}

/** Aguarda outra sessão do banco isolado ficar bloqueada por lock real. */
async function aguardarBloqueio() {
  for (let i = 0; i < 100; i++) {
    const [row] = await admin`select count(*)::int as total from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`;
    if (row.total > 0) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Nenhuma sessão concorrente ficou bloqueada.');
}

test('migration é aditiva: colunas novas anuláveis, NOT VALID no legado e tabelas protegidas', async () => {
  const m = await metadados(sql);
  const coluna = (table: string, name: string) => m.columns.find(c => c.table === table && c.name === name);
  expect(coluna('viagem', 'criado_em')).toMatchObject({ type: 'timestamp with time zone', nullable: true, default: 'clock_timestamp()' });
  expect(coluna('viagem', 'validada_por_id')).toMatchObject({ type: 'bigint', nullable: true, default: null });
  expect(coluna('viagem', 'validada_em')).toMatchObject({ type: 'timestamp with time zone', nullable: true, default: null });
  expect(coluna('notificacao', 'tipo')).toMatchObject({ type: 'text', nullable: true, default: null });
  expect(coluna('notificacao', 'viagem_id')).toMatchObject({ type: 'bigint', nullable: true, default: null });
  expect(coluna('viagem_evidencia', 'dados')).toMatchObject({ type: 'bytea', nullable: false });
  expect(coluna('viagem', 'dados')).toBeUndefined();
  expect(m.enums.find(e => e.name === 'status_viagem')?.values).toEqual(['AGENDADA', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA']);
  const legado = m.constraints.filter(c => c.table === 'viagem' && c.type === 'c');
  expect(legado.map(c => c.name).sort()).toEqual(['viagem_dados_obrigatorios_check', 'viagem_execucao_status_check',
    'viagem_km_final_check', 'viagem_km_inicial_check', 'viagem_periodo_check', 'viagem_validacao_check']);
  expect(legado.every(c => !c.validated && c.definition.endsWith('NOT VALID'))).toBe(true);
  expect(m.constraints.find(c => c.name === 'viagem_solicitacao_id_key')).toMatchObject({ type: 'u', columns: ['solicitacao_id'] });
  for (const nome of ['viagem_evidencia', 'viagem_correcao', 'notificacao']) {
    expect(m.tables.find(t => t.name === nome)).toMatchObject({ rls: true, forceRls: false });
    const [acesso] = await sql`select has_table_privilege('anon', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') as anon,
      has_table_privilege('authenticated', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') as authenticated`;
    expect(acesso).toEqual({ anon: false, authenticated: false });
  }
  for (const nome of ['viagem_evidencia', 'viagem_correcao']) {
    const [app] = await sql`select has_table_privilege(current_user, ${'public.' + nome}, 'SELECT') as leitura,
      has_table_privilege(current_user, ${'public.' + nome}, 'INSERT') as insercao,
      has_table_privilege(current_user, ${'public.' + nome}, 'UPDATE') as alteracao,
      has_table_privilege(current_user, ${'public.' + nome}, 'DELETE') as exclusao`;
    expect(app).toEqual({ leitura: true, insercao: true, alteracao: false, exclusao: false });
  }
  const indices = await sql`select c.relname as nome, x.indisvalid, x.indisready from pg_index x
    join pg_class c on c.oid = x.indexrelid
    where c.relname in ('viagem_motorista_status_idx', 'viagem_status_periodo_idx', 'notificacao_viagem_idx') order by 1`;
  expect(indices).toEqual(['notificacao_viagem_idx', 'viagem_motorista_status_idx', 'viagem_status_periodo_idx']
    .map(nome => ({ nome, indisvalid: true, indisready: true })));
});

test('ciclo completo: criação 1:1, execução, evidências versionadas, correção, validação e aviso', async () => {
  const erro = await sql.begin(async tx => {
    const viagem = await cenario(tx, -28101);
    expect(viagem).toMatchObject({ status: 'AGENDADA', validada_por_gestor: false });
    expect(viagem.criado_em).toBeInstanceOf(Date);
    const [protocolo] = await tx`select s.codigo from public.viagem v
      join public.solicitacao_viagem s on s.id = v.solicitacao_id where v.id = -28101`;
    expect(protocolo.codigo).toBe('S8T28101');
    await tx`update public.viagem set status = 'EM_TRANSPORTE', data_inicio = '2026-11-10 08:05:00', km_inicial = 1000
      where id = -28101`;
    await tx`insert into public.viagem_evidencia (viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
      values (-28101, 'INICIAL', 1, 'odometro-inicial.png', 'image/png', ${png}, ${USUARIO_MOTORISTA})`;
    await tx`update public.viagem set status = 'CONCLUIDA', data_fim = '2026-11-10 10:00:00', km_final = 1080
      where id = -28101`;
    for (const versao of [1, 2]) {
      await tx`insert into public.viagem_evidencia (viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
        values (-28101, 'FINAL', ${versao}, ${'odometro-final-v' + versao + '.png'}, 'image/png', ${png}, ${USUARIO_MOTORISTA})`;
    }
    await tx`insert into public.viagem_correcao (viagem_id, versao, km_inicial_anterior, km_final_anterior,
      km_inicial, km_final, justificativa, autor_id)
      values (-28101, 1, 1000, 1080, 1000, 1085, 'Leitura do odômetro final corrigida pela foto v2', ${GESTOR})`;
    await tx`update public.viagem set km_final = 1085 where id = -28101`;
    await tx`update public.viagem set validada_por_gestor = true, validada_por_id = ${GESTOR},
      validada_em = clock_timestamp() where id = -28101`;
    for (let i = 0; i < 2; i++) {
      await tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo, viagem_id)
        values (${USUARIO_MOTORISTA}, ${'viagem:-28101:atribuicao:' + MOTORISTA}, 'Nova viagem atribuída',
          'Viagem #S8T28101', 'informacao', 'ATRIBUICAO', -28101)
        on conflict (usuario_id, chave) do nothing`;
    }
    await tx`update public.notificacao set lida_em = coalesce(lida_em, clock_timestamp())
      where usuario_id = ${USUARIO_MOTORISTA} and viagem_id = -28101`;
    const [final] = await tx`select status::text, km_inicial, km_final, validada_por_gestor, validada_por_id::int,
      (select count(*)::int from public.viagem_evidencia where viagem_id = -28101) as evidencias,
      (select max(versao) from public.viagem_evidencia where viagem_id = -28101 and momento = 'FINAL') as versao_final,
      (select count(*)::int from public.viagem_correcao where viagem_id = -28101) as correcoes,
      (select count(*)::int from public.notificacao where viagem_id = -28101) as avisos,
      (select count(*)::int from public.notificacao where viagem_id = -28101 and lida_em is not null) as lidos
      from public.viagem where id = -28101`;
    expect(final).toEqual({ status: 'CONCLUIDA', km_inicial: 1000, km_final: 1085, validada_por_gestor: true,
      validada_por_id: GESTOR, evidencias: 3, versao_final: 2, correcoes: 1, avisos: 1, lidos: 1 });
    throw desfazer;
  }).catch((e: unknown) => e);
  expect(erro).toBe(desfazer);
});

test('quilometragem final inferior à inicial, negativa ou sem inicial é rejeitada', async () => {
  for (const [sqlUpdate, constraint] of [
    [(tx: Tx) => tx`update public.viagem set km_inicial = 1000, km_final = 999 where id = -28101`, 'viagem_km_final_check'],
    [(tx: Tx) => tx`update public.viagem set km_final = 10 where id = -28101`, 'viagem_km_final_check'],
    [(tx: Tx) => tx`update public.viagem set km_inicial = -1 where id = -28101`, 'viagem_km_inicial_check'],
    [(tx: Tx) => tx`insert into public.viagem_correcao (viagem_id, versao, km_inicial, km_final, justificativa, autor_id)
      values (-28101, 1, 1000, 990, 'Correção inválida', ${GESTOR})`, 'viagem_correcao_km_check'],
  ] as const) {
    expect(await erroDe(sqlUpdate)).toMatchObject({ code: '23514', constraint_name: constraint });
  }
});

test('período, estado de execução e validação do Gestor exigem dados coerentes', async () => {
  for (const [operacao, constraint] of [
    [(tx: Tx) => tx`update public.viagem set data_inicio = '2026-11-10 10:00:00', data_fim = '2026-11-10 09:00:00'
      where id = -28101`, 'viagem_periodo_check'],
    [(tx: Tx) => tx`update public.viagem set data_fim = '2026-11-10 09:00:00' where id = -28101`, 'viagem_periodo_check'],
    [(tx: Tx) => tx`update public.viagem set status = 'EM_TRANSPORTE', data_inicio = '2026-11-10 08:00:00'
      where id = -28101`, 'viagem_execucao_status_check'],
    [(tx: Tx) => tx`update public.viagem set status = 'CONCLUIDA', data_inicio = '2026-11-10 08:00:00', km_inicial = 1000
      where id = -28101`, 'viagem_execucao_status_check'],
    [(tx: Tx) => tx`update public.viagem set validada_por_gestor = true where id = -28101`, 'viagem_validacao_check'],
    [(tx: Tx) => tx`update public.viagem set validada_por_gestor = true, validada_por_id = ${GESTOR},
      validada_em = clock_timestamp() where id = -28101`, 'viagem_validacao_check'],
    [(tx: Tx) => tx`update public.viagem set validada_por_id = ${GESTOR} where id = -28101`, 'viagem_validacao_check'],
  ] as const) {
    expect(await erroDe(operacao)).toMatchObject({ code: '23514', constraint_name: constraint });
  }
});

test('associação inválida: recurso ausente/inexistente, evidência órfã e aviso sem demanda correta', async () => {
  const casos: [(tx: Tx) => Promise<unknown>, string, string][] = [
    [tx => tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
      values (-28102, -27007, ${VEICULO}, -999999)`, '23503', 'viagem_motorista_id_fkey'],
    [tx => tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
      values (-28102, -27007, null, ${MOTORISTA})`, '23514', 'viagem_dados_obrigatorios_check'],
    [tx => tx`insert into public.viagem (id, veiculo_id, motorista_id)
      values (-28102, ${VEICULO}, ${MOTORISTA})`, '23514', 'viagem_dados_obrigatorios_check'],
    [tx => tx`update public.viagem set status = 'CONCLUIDA', data_inicio = '2026-11-10 08:00:00', km_inicial = 1000,
      data_fim = '2026-11-10 09:00:00', km_final = 1010, validada_por_gestor = true, validada_por_id = -999999,
      validada_em = clock_timestamp() where id = -28101`, '23503', 'viagem_validada_por_fk'],
    [tx => tx`insert into public.viagem_evidencia (viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
      values (-999999, 'INICIAL', 1, 'a.png', 'image/png', ${png}, ${USUARIO_MOTORISTA})`, '23503', 'viagem_evidencia_viagem_fk'],
    [tx => tx`insert into public.viagem_correcao (viagem_id, versao, justificativa, autor_id)
      values (-28101, 1, 'Autor inexistente', -999999)`, '23503', 'viagem_correcao_autor_fk'],
    [tx => tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo)
      values (${USUARIO_MOTORISTA}, 'viagem:-28101:atribuicao:1', 'Aviso', 'Sem demanda', 'informacao', 'ATRIBUICAO')`,
    '23514', 'notificacao_demanda_check'],
    [tx => tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo, viagem_id)
      values (${USUARIO_MOTORISTA}, 'viagem:-27001:atribuicao:1', 'Aviso', 'Chave de outra viagem', 'informacao',
        'ATRIBUICAO', -28101)`, '23514', 'notificacao_demanda_check'],
    [tx => tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo, viagem_id)
      values (${USUARIO_MOTORISTA}, 'viagem:-28101:leitura:1', 'Aviso', 'Tipo inexistente', 'informacao',
        'LEITURA', -28101)`, '23514', 'notificacao_tipo_check'],
    [tx => tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo, viagem_id)
      values (${USUARIO_MOTORISTA}, 'viagem:-28101:lembrete:1', 'Aviso', 'Viagem inexistente', 'informacao',
        'LEMBRETE', -999999)`, '23514', 'notificacao_demanda_check'],
  ];
  for (const [operacao, code, constraint] of casos) {
    expect(await erroDe(operacao)).toMatchObject({ code, constraint_name: constraint });
  }
});

test('evidência valida formato, tamanho, momento e versão sem duplicidade', async () => {
  const inserir = (tx: Tx, valores: { momento?: string; versao?: number; nome?: string; tipo?: string; dados?: Buffer }) =>
    tx`insert into public.viagem_evidencia (viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
      values (-28101, ${valores.momento ?? 'INICIAL'}, ${valores.versao ?? 1}, ${valores.nome ?? 'foto.png'},
        ${valores.tipo ?? 'image/png'}, ${valores.dados ?? png}, ${USUARIO_MOTORISTA})`;
  const casos: [Parameters<typeof inserir>[1], string, string][] = [
    [{ tipo: 'application/pdf' }, '23514', 'viagem_evidencia_tipo_check'],
    [{ dados: Buffer.alloc(0) }, '23514', 'viagem_evidencia_tamanho_check'],
    [{ dados: Buffer.alloc(1048577, 1) }, '23514', 'viagem_evidencia_tamanho_check'],
    [{ momento: 'MEIO' }, '23514', 'viagem_evidencia_momento_check'],
    [{ versao: 0 }, '23514', 'viagem_evidencia_versao_check'],
    [{ nome: '' }, '23514', 'viagem_evidencia_nome_check'],
  ];
  for (const [valores, code, constraint] of casos) {
    expect(await erroDe(tx => inserir(tx, valores))).toMatchObject({ code, constraint_name: constraint });
  }
  expect(await erroDe(async tx => { await inserir(tx, {}); await inserir(tx, {}); }))
    .toMatchObject({ code: '23505', constraint_name: 'viagem_evidencia_versao_key' });
  expect(await erroDe(tx => inserir(tx, { dados: Buffer.alloc(1048576, 1) }))).toBe(desfazer);
});

test('correção exige justificativa e histórico append-only não aceita alteração nem acesso público', async () => {
  for (const justificativa of ['', '   ', 'x'.repeat(2001)]) {
    expect(await erroDe(tx => tx`insert into public.viagem_correcao (viagem_id, versao, justificativa, autor_id)
      values (-28101, 1, ${justificativa}, ${GESTOR})`))
      .toMatchObject({ code: '23514', constraint_name: 'viagem_correcao_justificativa_check' });
  }
  for (const operacao of [
    (tx: Tx) => tx`update public.viagem_correcao set justificativa = 'reescrita' where viagem_id = -28101`,
    (tx: Tx) => tx`delete from public.viagem_correcao where viagem_id = -28101`,
    (tx: Tx) => tx`update public.viagem_evidencia set nome = 'troca.png' where viagem_id = -28101`,
    (tx: Tx) => tx`delete from public.viagem_evidencia where viagem_id = -28101`,
  ]) {
    expect(await erroDe(operacao)).toMatchObject({ code: '42501' });
  }
  for (const role of ['anon', 'authenticated']) {
    for (const consulta of ['select id from public.viagem_evidencia', 'select id from public.viagem_correcao',
      "insert into public.viagem_correcao (viagem_id, versao, justificativa, autor_id) values (-28101, 1, 'x', -27002)"]) {
      expect(await erroDe(async tx => { await tx.unsafe('set local role ' + role); await tx.unsafe(consulta); }, admin))
        .toMatchObject({ code: '42501' });
    }
  }
});

test('geração duplicada de viagem para a mesma solicitação é recusada', async () => {
  expect(await erroDe(tx => tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
    values (-28102, -28101, ${VEICULO}, ${MOTORISTA})`))
    .toMatchObject({ code: '23505', constraint_name: 'viagem_solicitacao_id_key' });
});

test('duas requisições simultâneas geram uma única viagem; a segunda recebe 23505', async () => {
  try {
    await sql.begin(async tx => {
      await tx`insert into public.solicitacao_viagem
        (id, codigo, solicitante_id, origem, destino, data_hora_saida, status, veiculo_id, motorista_id)
        values (-28201, 'S8T28201', ${SOLICITANTE}, 'Origem de teste', 'Destino de teste',
          '2026-11-10 08:00:00', 'AGENDADA', ${VEICULO}, ${MOTORISTA})`;
    });
    let liberar!: () => void;
    const segurar = new Promise<void>(r => { liberar = r; });
    let primeiraGravou!: () => void;
    const gravou = new Promise<void>(r => { primeiraGravou = r; });
    const primeira = sql.begin(async tx => {
      await tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
        values (-28201, -28201, ${VEICULO}, ${MOTORISTA})`;
      primeiraGravou();
      await segurar;
    });
    await gravou;
    const segunda = outra.begin(tx => tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id)
      values (-28202, -28201, ${VEICULO}, ${MOTORISTA})`).then(() => null, (e: unknown) => e);
    await aguardarBloqueio();
    liberar();
    await primeira;
    expect(await segunda).toMatchObject({ code: '23505', constraint_name: 'viagem_solicitacao_id_key' });
    const linhas = await sql`select id::int from public.viagem where solicitacao_id = -28201`;
    expect(linhas).toEqual([{ id: -28201 }]);
  } finally {
    await admin`delete from public.viagem where solicitacao_id = -28201`;
    await admin`delete from public.solicitacao_viagem where id = -28201`;
  }
});

test('correções simultâneas na mesma versão: apenas uma é registrada', async () => {
  try {
    await sql.begin(async tx => { await cenario(tx, -28203); });
    let liberar!: () => void;
    const segurar = new Promise<void>(r => { liberar = r; });
    let primeiraGravou!: () => void;
    const gravou = new Promise<void>(r => { primeiraGravou = r; });
    const corrigir = (tx: Tx, texto: string) => tx`insert into public.viagem_correcao (viagem_id, versao, justificativa, autor_id)
      values (-28203, 1, ${texto}, ${GESTOR})`;
    const primeira = sql.begin(async tx => { await corrigir(tx, 'Primeira justificativa'); primeiraGravou(); await segurar; });
    await gravou;
    const segunda = outra.begin(tx => corrigir(tx, 'Segunda justificativa')).then(() => null, (e: unknown) => e);
    await aguardarBloqueio();
    liberar();
    await primeira;
    expect(await segunda).toMatchObject({ code: '23505', constraint_name: 'viagem_correcao_versao_key' });
    const linhas = await sql`select justificativa from public.viagem_correcao where viagem_id = -28203`;
    expect(linhas).toEqual([{ justificativa: 'Primeira justificativa' }]);
  } finally {
    await admin`delete from public.viagem_correcao where viagem_id = -28203`;
    await admin`delete from public.viagem where id = -28203`;
    await admin`delete from public.solicitacao_viagem where id = -28203`;
  }
});

test('aviso de lembrete não duplica na mesma janela e aceita nova janela', async () => {
  const erro = await sql.begin(async tx => {
    await cenario(tx, -28101);
    for (const janela of ['2026-11-10T07:00', '2026-11-10T07:00', '2026-11-10T07:30']) {
      await tx`insert into public.notificacao (usuario_id, chave, titulo, descricao, categoria, tipo, viagem_id)
        values (${USUARIO_MOTORISTA}, ${'viagem:-28101:lembrete:' + janela}, 'Lembrete de viagem', 'Viagem #S8T28101',
          'atencao', 'LEMBRETE', -28101) on conflict (usuario_id, chave) do nothing`;
    }
    const avisos = await tx`select chave from public.notificacao where viagem_id = -28101 order by chave`;
    expect(avisos.map(a => a.chave)).toEqual(['viagem:-28101:lembrete:2026-11-10T07:00', 'viagem:-28101:lembrete:2026-11-10T07:30']);
    throw desfazer;
  }).catch((e: unknown) => e);
  expect(erro).toBe(desfazer);
});

test('preflight é somente leitura e não acusa divergência nas fixtures atuais', async () => {
  const [legado, associacao, constraints, protecao] = await sql.begin('isolation level repeatable read read only',
    async tx => { const rows = []; for (const q of preflight) rows.push(await tx.unsafe(q)); return rows; });
  expect(legado[0]).toMatchObject({ verificacao: 'viagens_legadas', sem_dados_obrigatorios: 0, km_inicial_negativo: 0,
    km_final_invalido: 0, periodo_invalido: 0, execucao_incompleta: 0, validacao_sem_autor_ou_conclusao: 0 });
  expect(associacao[0]).toMatchObject({ verificacao: 'associacao', recursos_divergentes: 0 });
  expect(constraints.filter(c => c.tabela === 'viagem' && c.contype === 'c' && !c.convalidated)).toHaveLength(6);
  expect(protecao.map(p => ({ nome: p.nome, existe: p.existe, rls: p.rls, anon: p.anon_select })))
    .toEqual(['notificacao', 'viagem_correcao', 'viagem_evidencia'].map(nome => ({ nome, existe: true, rls: true, anon: false })));
});

test('migration convive com dados legados divergentes; VALIDATE só após reconciliação', async () => {
  const erro = await admin.begin(async tx => {
    await tx.unsafe(reversao);
    // Linhas antigas incoerentes, gravadas antes da regra existir.
    await tx`insert into public.viagem (id, solicitacao_id, veiculo_id, motorista_id, km_inicial, km_final,
      data_inicio, data_fim, validada_por_gestor, status)
      values (-28301, null, null, null, 1000, 900, '2026-01-02 10:00:00', '2026-01-01 10:00:00', true, 'CONCLUIDA'),
             (-28302, null, ${VEICULO}, ${MOTORISTA}, null, null, null, null, false, 'EM_TRANSPORTE')`;
    await tx.unsafe(migration);
    const [legado] = await tx.unsafe(preflight[0]);
    expect(legado).toMatchObject({ sem_dados_obrigatorios: 2, km_final_invalido: 1, periodo_invalido: 1,
      execucao_incompleta: 1, validacao_sem_autor_ou_conclusao: 1 });
    const [antigo] = await tx`select criado_em, validada_por_id from public.viagem where id = -28301`;
    expect(antigo).toEqual({ criado_em: null, validada_por_id: null });
    await tx`alter table public.viagem validate constraint viagem_km_final_check`;
    throw desfazer;
  }).catch((e: unknown) => e);
  expect(erro).toMatchObject({ code: '23514', constraint_name: 'viagem_km_final_check' });
});

test('rollback recusa dados novos e, sem eles, restaura o esquema anterior e permite reaplicar', async () => {
  const recusa = await admin.begin(async tx => {
    await cenario(tx, -28101);
    await tx`insert into public.viagem_evidencia (viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
      values (-28101, 'INICIAL', 1, 'foto.png', 'image/png', ${png}, ${USUARIO_MOTORISTA})`;
    await tx.unsafe(reversao);
  }).catch((e: unknown) => e);
  expect(recusa).toMatchObject({ code: 'P0001' });

  const novos = new Set(['viagem_evidencia', 'viagem_correcao']);
  const colunas = new Set(['viagem.criado_em', 'viagem.validada_por_id', 'viagem.validada_em', 'notificacao.tipo', 'notificacao.viagem_id']);
  const indices = new Set(['viagem_motorista_status_idx', 'viagem_status_periodo_idx', 'notificacao_viagem_idx']);
  const constraints = new Set(['viagem_validada_por_fk', 'viagem_dados_obrigatorios_check', 'viagem_km_inicial_check',
    'viagem_km_final_check', 'viagem_periodo_check', 'viagem_execucao_status_check', 'viagem_validacao_check',
    'notificacao_viagem_fk', 'notificacao_tipo_check', 'notificacao_demanda_check']);
  const anterior = (m: Metadata): Metadata => ({ ...m,
    tables: m.tables.filter(t => !novos.has(t.name)),
    columns: m.columns.filter(c => !novos.has(c.table) && !colunas.has(c.table + '.' + c.name)),
    constraints: m.constraints.filter(c => !novos.has(c.table) && !constraints.has(c.name)),
    indexes: m.indexes.filter(i => !novos.has(i.table) && !indices.has(i.name)),
    sequences: m.sequences.filter(s => !novos.has(s.table)) });
  // DROP/ADD COLUMN muda attnum; a ordem relativa das colunas é o que se compara.
  const ordinal = (m: Metadata): Metadata => ({ ...m, columns: m.columns.map(c => ({ ...c,
    position: m.columns.filter(o => o.table === c.table && o.position <= c.position).length })) });

  const erro = await admin.begin(async tx => {
    const aplicado = await metadados(tx);
    await tx.unsafe(reversao);
    const revertido = await metadados(tx);
    expect(revertido).toEqual(anterior(aplicado));
    expect(revertido.tables.some(t => novos.has(t.name))).toBe(false);
    await tx.unsafe(migration);
    expect(ordinal(await metadados(tx))).toEqual(ordinal(aplicado));
    throw desfazer;
  }).catch((e: unknown) => e);
  expect(erro).toBe(desfazer);
});
