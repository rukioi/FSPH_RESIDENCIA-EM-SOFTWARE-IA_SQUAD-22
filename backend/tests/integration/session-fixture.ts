import { vi } from 'vitest';

// Domain tests isolate resource SQL. usuarios-sessao.test.ts proves the real lookup.
vi.mock('../../src/modules/usuarios/usuarios.repository.js', () => ({
  consultarIdentidade: async (id: string) => {
    const perfil = ({ '-27001': 'ADM', '-27002': 'GESTOR_FROTA', '-27003': 'SOLICITANTE_INTERNO',
      '-27004': 'MOTORISTA', '-27005': 'ATENDENTE_SVO', '1': 'ATENDENTE_SVO' } as Record<string, string>)[id];
    return perfil ? { id, nome: 'Fixture de sessão', email: 'fixture@example.invalid', perfil, ativo: true } : undefined;
  },
}));
