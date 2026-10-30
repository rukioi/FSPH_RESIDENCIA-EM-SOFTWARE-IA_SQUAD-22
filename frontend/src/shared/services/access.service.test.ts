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