import { afterAll, beforeAll, expect, test } from 'vitest';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let admin: Awaited<ReturnType<typeof verifiedSql>>;
let runtime: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => {admin=await verifiedSql(true); runtime=await verifiedSql();});
afterAll(async () => {await Promise.all([admin?.end(),runtime?.end()]);});

test('revisão possui PK, FK RESTRICT, checks, índice válido e RLS sem publicações diretas',async()=>{
  const [t]=await admin`SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.manutencao_alerta_revisao'::regclass`;
  expect(t.rls).toBe(true);
  const constraints=await admin`SELECT contype,convalidated,confdeltype,pg_get_constraintdef(oid) AS ddl
    FROM pg_constraint WHERE conrelid='public.manutencao_alerta_revisao'::regclass ORDER BY contype,conname`;
  expect(constraints).toHaveLength(4);
  expect(constraints.every(c=>c.convalidated===true)).toBe(true);
  expect(constraints).toEqual(expect.arrayContaining([
    expect.objectContaining({contype:'f',confdeltype:'r'}),
    expect.objectContaining({contype:'p',ddl:'PRIMARY KEY (manutencao_id, alerta)'}),
  ]));
  const [indice]=await admin`SELECT count(*)::int AS n,bool_and(indisunique AND indisvalid) AS valido FROM pg_index
    WHERE indrelid='public.manutencao_alerta_revisao'::regclass`;
  expect(indice).toMatchObject({n:1,valido:true});
  const grants=await admin`SELECT grantee,privilege_type FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))
    WHERE c.oid='public.manutencao_alerta_revisao'::regclass AND grantee=0`;
  expect(grants).toEqual([]);
  const negados=await admin`SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
    AND has_table_privilege(oid,'public.manutencao_alerta_revisao',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')`;
  expect(negados).toEqual([]);
  const [permissoes]=await runtime`SELECT current_user AS papel,
    has_table_privilege(current_user,'public.manutencao_alerta_revisao','SELECT') AS leitura,
    has_table_privilege(current_user,'public.manutencao_alerta_revisao','INSERT') AS insercao,
    has_table_privilege(current_user,'public.manutencao_alerta_revisao','UPDATE') AS atualizacao,
    has_table_privilege(current_user,'public.manutencao_alerta_revisao','DELETE,TRUNCATE') AS destrutivo`;
  expect(permissoes).toMatchObject({papel:'postgres',leitura:true,insercao:true,atualizacao:true,destrutivo:false});
});

test('papel sintético sem BYPASSRLS opera com policies e grants mínimos; FK e checks recusam dados inválidos',async()=>{
  const fim=new Error('Descartar fixture de privilégios');
  await expect(admin.begin(async tx=>{
    await tx`INSERT INTO public.manutencao_veiculo
      (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
      VALUES (-23442900,-27003,'PREVENTIVA','Fixture ACL','2026-12-01T03:00:00Z','2026-12-01T03:00:00Z',0,'AGENDADA',-27001,-27001)`;
    await tx`CREATE ROLE s234_alerta_fixture NOLOGIN NOBYPASSRLS`;
    await tx`GRANT USAGE ON SCHEMA public TO s234_alerta_fixture`;
    await tx`GRANT SELECT,INSERT,UPDATE ON public.manutencao_alerta_revisao TO s234_alerta_fixture`;
    await tx`CREATE POLICY s234_select ON public.manutencao_alerta_revisao FOR SELECT TO s234_alerta_fixture USING (true)`;
    await tx`CREATE POLICY s234_insert ON public.manutencao_alerta_revisao FOR INSERT TO s234_alerta_fixture WITH CHECK (true)`;
    await tx`CREATE POLICY s234_update ON public.manutencao_alerta_revisao FOR UPDATE TO s234_alerta_fixture USING (true) WITH CHECK (true)`;
    await tx`SET LOCAL ROLE s234_alerta_fixture`;
    await expect(tx.savepoint(sp=>sp`INSERT INTO public.manutencao_alerta_revisao VALUES (-23442901,'ATRASO',1)`))
      .rejects.toMatchObject({code:'23503'});
    await expect(tx.savepoint(sp=>sp`INSERT INTO public.manutencao_alerta_revisao VALUES (-23442900,'OUTRO',1)`))
      .rejects.toMatchObject({code:'23514'});
    await expect(tx.savepoint(sp=>sp`INSERT INTO public.manutencao_alerta_revisao VALUES (-23442900,'ATRASO',0)`))
      .rejects.toMatchObject({code:'23514'});
    await tx`INSERT INTO public.manutencao_alerta_revisao(manutencao_id,alerta) VALUES (-23442900,'ATRASO')`;
    await tx`UPDATE public.manutencao_alerta_revisao SET revisao=2 WHERE manutencao_id=-23442900`;
    expect(await tx`SELECT revisao::text FROM public.manutencao_alerta_revisao WHERE manutencao_id=-23442900`)
      .toEqual([{revisao:'2'}]);
    await expect(tx.savepoint(sp=>sp`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id=-23442900`))
      .rejects.toMatchObject({code:'42501'});
    await expect(tx.savepoint(sp=>sp`TRUNCATE public.manutencao_alerta_revisao`)).rejects.toMatchObject({code:'42501'});
    await tx`RESET ROLE`;
    await expect(tx.savepoint(sp=>sp`DELETE FROM public.manutencao_veiculo WHERE id=-23442900`))
      .rejects.toMatchObject({code:'23503'});
    throw fim;
  })).rejects.toBe(fim);
});
