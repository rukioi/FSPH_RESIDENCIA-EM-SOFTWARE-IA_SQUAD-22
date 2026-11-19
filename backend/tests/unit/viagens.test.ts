import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { UsuarioAutenticado } from '../../src/security/jwt.js';

const mocks = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock('../../src/modules/viagens/viagens.repository.js', () => ({ consultarMinhasViagens: mocks.consultar }));
import { listarMinhasViagens } from '../../src/modules/viagens/viagens.service.js';

const motorista: UsuarioAutenticado = { id: '42', nome: 'Motorista', email: 'motorista@example.invalid', perfil: 'MOTORISTA' };
beforeEach(() => { mocks.consultar.mockReset(); mocks.consultar.mockResolvedValue({ rows: [], total: 0 }); });
describe('consulta institucional do motorista', () => {
  test('usa somente a identidade da sessão e aplica filtros e paginação', async () => {
    expect(await listarMinhasViagens({ page: '2', limit: '10', status: 'AGENDADA' }, motorista))
      .toEqual({ data: [], meta: { page: 2, limit: 10, total: 0 } });
    expect(mocks.consultar).toHaveBeenCalledWith('42', { page: 2, limit: 10, status: 'AGENDADA' });
  });
  test.each([{ motoristaId: '99' }, { page: '0' }, { limit: '101' }, { status: 'INVALIDO' }, { page: ['1', '2'] }])('rejeita filtros inválidos e não consulta o banco: %o', async query => {
      await expect(listarMinhasViagens(query, motorista)).rejects.toMatchObject({ status: 400 });
      expect(mocks.consultar).not.toHaveBeenCalled();
    });
  test('impede outro perfil mesmo com chamada direta ao serviço', async () => {
    await expect(listarMinhasViagens({}, { ...motorista, perfil: 'ADM' })).rejects.toMatchObject({ status: 403 });
    expect(mocks.consultar).not.toHaveBeenCalled();
  });
});
