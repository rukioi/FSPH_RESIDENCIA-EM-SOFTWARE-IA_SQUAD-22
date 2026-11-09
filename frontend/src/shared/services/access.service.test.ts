import { expect, test } from 'vitest'
import { ROTAS } from '../../app/routes/rotas'
import { perfilPodeAcessar } from './access.service'

test('gestor só acessa telas de gestor autorizadas', () => {
  expect(perfilPodeAcessar(ROTAS.dashboardGestor, 'GESTOR_FROTA')).toBe(true)
  expect(perfilPodeAcessar(ROTAS.configuracoes, 'GESTOR_FROTA')).toBe(false)
  expect(perfilPodeAcessar('/rota-inexistente', 'GESTOR_FROTA')).toBe(false)
})

test('rotas administrativas e SVO exigem seus perfis', () => {
  expect(perfilPodeAcessar(ROTAS.auditoria, 'ADM')).toBe(true)
  expect(perfilPodeAcessar('/svo', 'GESTOR_FROTA')).toBe(false)
  expect(perfilPodeAcessar('/svo', 'ATENDENTE_SVO')).toBe(true)
})

test('abastecimentos permite somente os perfis operacionais autorizados', () => {
  for (const perfil of ['ADM', 'GESTOR_FROTA']) {
    expect(perfilPodeAcessar(ROTAS.abastecimentosGestor, perfil)).toBe(true)
  }
  for (const perfil of ['ATENDENTE_SVO', 'MOTORISTA', 'SOLICITANTE_INTERNO']) {
    expect(perfilPodeAcessar(ROTAS.abastecimentosGestor, perfil)).toBe(false)
  }
})

test('detalhes e edicao do gestor preservam controle de perfil e caminhos validos', () => {
  expect(perfilPodeAcessar('/gestor/solicitacoes/1024', 'GESTOR_FROTA')).toBe(true)
  expect(perfilPodeAcessar('/gestor/solicitacoes/1024/editar', 'ADM')).toBe(true)
  expect(perfilPodeAcessar('/gestor/solicitacoes/1024', 'SOLICITANTE_INTERNO')).toBe(false)
  expect(perfilPodeAcessar('/gestor/solicitacoes/1024/excluir', 'GESTOR_FROTA')).toBe(false)
  expect(perfilPodeAcessar('/gestor/solicitacoes/invalido', 'GESTOR_FROTA')).toBe(false)
})
