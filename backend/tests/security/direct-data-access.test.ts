import { expect, test } from 'vitest';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

test('ACL mínima simulada bloqueia anon/authenticated e preserva runtime sem privilégios de dono', async () => {
  const sql = await verifiedSql(true);
  const rollback = new Error('rollback-fixture-t29');
  try {
    await expect(sql.begin(async tx => {
      await tx`CREATE ROLE fixture_t29_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE`;
      await tx`GRANT USAGE ON SCHEMA public TO fixture_t29_runtime`;
      await tx`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fixture_t29_runtime`;
      await tx`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fixture_t29_runtime`;
      await tx`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated`;
      await tx`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated`;
      await tx`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated`;
      await tx`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated`;
      await tx`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated`;
      await tx`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated`;
      for (const role of ['anon','authenticated']) {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        for (const query of ['SELECT id FROM public.usuario', 'SELECT observacoes_medicas FROM public.solicitacao_obito',
          'UPDATE public.usuario SET ativo=false WHERE false', "SELECT nextval('public.usuario_id_seq')"]) {
          await expect(tx.savepoint(async sp => { await sp.unsafe(query); })).rejects.toMatchObject({code:'42501'});
        }
        await tx`RESET ROLE`;
      }
      await tx`SET LOCAL ROLE fixture_t29_runtime`;
      const [role] = await tx`select current_user as name, rolsuper as super, rolbypassrls as bypass
        from pg_roles where rolname=current_user`;
      expect(role).toEqual({name:'fixture_t29_runtime',super:false,bypass:false});
      const [usuario]=await tx`select id,perfil,ativo from public.usuario where id=-27001`;
      expect(usuario.perfil).toBe('ADM');
      await tx`insert into public.usuario (id,nome,email,senha_hash,perfil,ativo)
        values (29901,'Fixture ACL','t29-acl@example.invalid','hash-ficticio','SOLICITANTE_INTERNO',true)`;
      await tx`update public.usuario set ativo=false where id=29901`;
      const [alterado]=await tx`select ativo from public.usuario where id=29901`;
      expect(alterado.ativo).toBe(false);
      await tx`delete from public.usuario where id=29901`;
      await expect(tx.savepoint(async sp => { await sp`truncate public.usuario cascade`; })).rejects.toMatchObject({code:'42501'});
      await tx`RESET ROLE`;
      await tx`SET LOCAL ROLE postgres`;
      await tx`CREATE TABLE public.fixture_t29_default (id bigint)`;
      await tx`RESET ROLE`;
      for (const role of ['anon','authenticated']) {
        const [access]=await tx`select has_table_privilege(${role},'public.fixture_t29_default','SELECT') as allowed`;
        expect(access.allowed).toBe(false);
      }
      throw rollback;
    })).rejects.toBe(rollback);
    const [restored]=await sql`select has_table_privilege('anon','public.usuario','SELECT') as allowed,
      exists(select 1 from pg_roles where rolname='fixture_t29_runtime') as runtime`;
    expect(restored).toEqual({allowed:true,runtime:false});
  } finally { await sql.end(); }
});
