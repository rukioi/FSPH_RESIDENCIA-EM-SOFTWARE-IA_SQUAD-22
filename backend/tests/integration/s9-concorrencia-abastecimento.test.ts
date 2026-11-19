import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const fixtureAdmin = await verifiedSql(true);
const server = createApp();
const ids = { usuario: 9371001, motorista: 9371002, base: 9371100 };
let base = '', token = '', created = false;

beforeAll(async () => {
  await sql.begin(async tx => {
    await tx.unsafe("INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES ($1,'Fixture S9','s9-concorrencia@example.invalid','fixture','GESTOR_FROTA',true)", [ids.usuario]);
    await tx.unsafe("INSERT INTO public.motorista(id,nome,cnh,categoria_cnh,validade_cnh) VALUES ($1,'Fixture S9','S9-CONCORRENCIA','B','2099-12-31')", [ids.motorista]);
    for (let i = 1; i <= 5; i++) {
      const v = ids.base + i, s = ids.base + 100 + i, t = ids.base + 200 + i;
      await tx.unsafe("INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,quilometragem_atual,is_svo) VALUES ($1,$2,'Teste','Teste',2026,$3,'DISPONIVEL',1000,$4)", [v, 'S9C000' + i, i === 5 ? 'RABECÃO_SVO' : 'PASSEIO', i === 5]);
      await tx.unsafe("INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES ($1,$2,$3,'A','B','Teste','2026-01-01 08:00','CONCLUIDA',$4,$5)", [s, 'S9-CORR-' + i, ids.usuario, ids.motorista, v]);
      await tx.unsafe("INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES ($1,$2,$3,$4,'CONCLUIDA',900,1000,'2026-01-01 08:00','2026-01-01 09:00')", [t, s, ids.motorista, v]);
    }
  });
  created = true;
  token = await criarJwt({ id: String(ids.usuario), perfil: 'GESTOR_FROTA' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});

afterAll(async () => {
  try {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    if (created) await fixtureAdmin.begin(async tx => {
      await tx.unsafe('DELETE FROM public.log_atividade WHERE usuario_id=$1', [ids.usuario]);
      await tx.unsafe('DELETE FROM public.viagem_correcao WHERE viagem_id BETWEEN $1 AND $2', [ids.base + 201, ids.base + 205]);
      await tx.unsafe('DELETE FROM public.log_atividade WHERE solicitacao_viagem_id BETWEEN $1 AND $2', [ids.base + 101, ids.base + 105]);
      await tx.unsafe('DELETE FROM public.abastecimento WHERE veiculo_id BETWEEN $1 AND $2', [ids.base + 1, ids.base + 5]);
      await tx.unsafe('DELETE FROM public.viagem WHERE id BETWEEN $1 AND $2', [ids.base + 201, ids.base + 205]);
      await tx.unsafe('DELETE FROM public.solicitacao_viagem WHERE id BETWEEN $1 AND $2', [ids.base + 101, ids.base + 105]);
      await tx.unsafe('DELETE FROM public.veiculo WHERE id BETWEEN $1 AND $2', [ids.base + 1, ids.base + 5]);
      await tx.unsafe('DELETE FROM public.motorista WHERE id=$1', [ids.motorista]);
      await tx.unsafe('DELETE FROM public.usuario WHERE id=$1', [ids.usuario]);
    });
  } finally { await sql.end(); await fixtureAdmin.end(); await fecharBanco(); }
});

function correction(i: number, km: number, confirm: boolean) {
  return fetch(base + '/api/viagens/' + (ids.base + 200 + i) + '/corrigir-quilometragem', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kmFinal: km, confirmarOdometroAtual: confirm, justificativa: 'Conferência de teste S9' }),
  });
}
function fueling(i: number, day: string, km: number) {
  return fetch(base + '/api/abastecimentos', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ veiculo_id: ids.base + i, motorista_id: ids.motorista, litragem: 10, valor_total: 50, quilometragem: km, data_abastecimento: day, posto: 'Fixture S9' }),
  });
}

test('mesmo dia permite correção sem confirmar odômetro e bloqueia confirmação indeterminada', async () => {
  expect((await fueling(1, '2026-01-01', 950)).status).toBe(201);
  expect((await correction(1, 990, true)).status).toBe(409);
  const [rejected] = await sql.unsafe('SELECT km_final FROM public.viagem WHERE id=$1', [ids.base + 201]);
  expect(rejected.km_final).toBe(1000);
  expect((await correction(1, 990, false)).status).toBe(200);
  const [state] = await sql.unsafe('SELECT quilometragem_atual FROM public.veiculo WHERE id=$1', [ids.base + 1]);
  expect(state.quilometragem_atual).toBe(1000);
});

test('contradição comprovada rejeita abastecimento sem escrita parcial', async () => {
  expect((await correction(2, 1050, true)).status).toBe(200);
  expect((await fueling(2, '2025-12-31', 901)).status).toBe(409);
  const [row] = await sql.unsafe('SELECT count(*)::int AS n FROM public.abastecimento WHERE veiculo_id=$1', [ids.base + 2]);
  expect(row.n).toBe(0);
});

test.each([[3, 'correcao'], [4, 'abastecimento']] as const)('concorrência sem deadlock: %s %s', async (i, first) => {
  let release!: () => void, ready!: () => void;
  const unblock = new Promise<void>(r => { release = r; });
  const locked = new Promise<void>(r => { ready = r; });
  const hold = sql.begin(async tx => { await tx.unsafe('SELECT id FROM public.veiculo WHERE id=$1 FOR UPDATE', [ids.base + i]); ready(); await unblock; });
  let monitor: Awaited<ReturnType<typeof verifiedSql>> | undefined;
  const wait = async (n: number) => {
    if (!monitor) throw new Error('Conexão de monitoramento indisponível.');
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const [r] = await monitor.unsafe("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'");
      if (r.n >= n) return;
      await new Promise(r => setTimeout(r, 30));
    }
    throw new Error('Operações não aguardaram o bloqueio.');
  };
  try {
    await locked;
    monitor = await verifiedSql();
    const a = first === 'correcao' ? correction(i, 1050, true) : fueling(i, '2025-12-31', 950);
    await wait(1);
    const b = first === 'correcao' ? fueling(i, '2025-12-31', 950) : correction(i, 1050, true);
    await wait(2);
    release(); await hold;
    const responses = await Promise.all([a, b]);
    expect(responses.map(r => r.status)).toEqual(first === 'correcao' ? [200, 409] : [201, 409]);
    const [row] = await monitor.unsafe('SELECT v.km_final,ve.quilometragem_atual,(SELECT count(*)::int FROM public.viagem_correcao WHERE viagem_id=v.id) AS correcoes,(SELECT count(*)::int FROM public.abastecimento WHERE veiculo_id=ve.id) AS abastecimentos FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=$1', [ids.base + 200 + i]);
    expect(row).toMatchObject(first === 'correcao' ? { km_final: 1050, quilometragem_atual: 1050, correcoes: 1, abastecimentos: 0 } : { km_final: 1000, quilometragem_atual: 1000, correcoes: 0, abastecimentos: 1 });
  } finally {
    release();
    try { await hold; }
    finally { await monitor?.end(); }
  }
}, 20000);

test('veículo SVO aceita abastecimento legítimo e mantém validações', async () => {
  expect((await fueling(5, '2026-01-01', 950)).status).toBe(201);
  expect((await correction(5, 990, true)).status).toBe(409);
  expect((await correction(5, 990, false)).status).toBe(200);
});

test('falha de auditoria reverte correção, odômetro e histórico', async () => {
  const [exists] = await sql.unsafe("SELECT to_regprocedure('public.s9_test_audit_failure_9371102()') IS NOT NULL AS present");
  if (exists.present) throw new Error('Função de teste já existe.');
  let fn = false, trigger = false;
  try {
    await fixtureAdmin.unsafe("CREATE FUNCTION public.s9_test_audit_failure_9371102() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.solicitacao_viagem_id=9371202 THEN RAISE EXCEPTION 's9 audit fixture'; END IF; RETURN NEW; END $$");
    fn = true;
    await fixtureAdmin.unsafe('CREATE TRIGGER s9_test_audit_failure_9371102 BEFORE INSERT ON public.log_atividade FOR EACH ROW EXECUTE FUNCTION public.s9_test_audit_failure_9371102()');
    trigger = true;
    const query = 'SELECT v.km_final,ve.quilometragem_atual,(SELECT count(*)::int FROM public.viagem_correcao WHERE viagem_id=v.id) AS correcoes FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=$1';
    const before = await sql.unsafe(query, [ids.base + 202]);
    expect((await correction(2, 1100, true)).status).toBe(500);
    expect(await sql.unsafe(query, [ids.base + 202])).toEqual(before);
  } finally {
    if (trigger) await fixtureAdmin.unsafe('DROP TRIGGER s9_test_audit_failure_9371102 ON public.log_atividade');
    if (fn) await fixtureAdmin.unsafe('DROP FUNCTION public.s9_test_audit_failure_9371102()');
  }
});
