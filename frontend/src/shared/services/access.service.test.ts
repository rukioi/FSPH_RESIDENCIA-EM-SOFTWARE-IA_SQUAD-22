import { describe, expect, it } from 'vitest'
import { perfilPodeAcessar, rotaConhecida } from './access.service'

const perfis = ['ADM', 'GESTOR_FROTA', 'SOLICITANTE_INTERNO', 'MOTORISTA', 'ATENDENTE_SVO']

describe('acesso aos detalhes e edição de solicitações', () => {
  it.each(['/solicitante/minhas-solicitacoes/12', '/solicitante/minhas-solicitacoes/12/editar'])(
    'restaura acesso SOLICITANTE_INTERNO a %s', caminho => {
      expect(rotaConhecida(caminho)).toBe(true)
      expect(perfilPodeAcessar(caminho, 'SOLICITANTE_INTERNO')).toBe(true)
      for (const perfil of perfis.filter(p => p !== 'SOLICITANTE_INTERNO')) {
        expect(perfilPodeAcessar(caminho, perfil)).toBe(false)
      }
    },
  )
  it.each(['/gestor/solicitacoes/12', '/gestor/solicitacoes/12/editar'])(
    'mantém acesso somente ADM/GESTOR_FROTA a %s', caminho => {
      expect(rotaConhecida(caminho)).toBe(true)
      expect(perfilPodeAcessar(caminho, 'ADM')).toBe(true)
      expect(perfilPodeAcessar(caminho, 'GESTOR_FROTA')).toBe(true)
      for (const perfil of ['SOLICITANTE_INTERNO', 'MOTORISTA', 'ATENDENTE_SVO']) {
        expect(perfilPodeAcessar(caminho, perfil)).toBe(false)
      }
    },
  )
  it.each([
    '/gestor/solicitacoes/invalido/editar',
    '/gestor/solicitacoes/invalido',
    '/solicitante/minhas-solicitacoes/invalido/editar',
    '/solicitante/minhas-solicitacoes/invalido',
  ])('não reconhece nem autoriza endereço malformado %s', caminho => {
    expect(rotaConhecida(caminho)).toBe(false)
    for (const perfil of perfis) expect(perfilPodeAcessar(caminho, perfil)).toBe(false)
  })
  it('preserva as permissões exclusivas das configurações ADM', () => {
    expect(perfilPodeAcessar('/admin/configuracoes', 'ADM')).toBe(true)
    expect(perfilPodeAcessar('/admin/configuracoes', 'GESTOR_FROTA')).toBe(false)
    expect(perfilPodeAcessar('/admin/configuracoes', 'SOLICITANTE_INTERNO')).toBe(false)
  })
  it('preserva os seletores e perfis de abastecimento e histórico do veículo', () => {
    for (const caminho of ['/gestor/abastecimentos/12', '/gestor/veiculos/12/abastecimentos']) {
      expect(rotaConhecida(caminho)).toBe(true)
      expect(perfilPodeAcessar(caminho, 'ADM')).toBe(true)
      expect(perfilPodeAcessar(caminho, 'GESTOR_FROTA')).toBe(true)
      expect(perfilPodeAcessar(caminho, 'SOLICITANTE_INTERNO')).toBe(false)
    }
  })
})


describe('acesso integrado a motoristas, veículos e manutenções', () => {
  it.each([
    ['/gestor/motoristas/12', ['ADM', 'GESTOR_FROTA']],
    ['/gestor/veiculos/12', ['ADM', 'GESTOR_FROTA']],
    ['/admin/manutencoes/12', ['ADM']],
    ['/gestor/manutencoes/12', ['GESTOR_FROTA']],
  ] as const)('aplica os perfis da rota %s', (caminho, permitidos) => {
    expect(rotaConhecida(caminho)).toBe(true)
    for (const perfil of perfis) {
      expect(perfilPodeAcessar(caminho, perfil)).toBe(permitidos.some(item => item === perfil))
    }
  })

  it.each(['/gestor/motoristas/12/editar', '/gestor/motoristas/9223372036854775808'])(
    'recusa detalhe de motorista inválido %s', caminho => {
      expect(rotaConhecida(caminho)).toBe(false)
      for (const perfil of perfis) expect(perfilPodeAcessar(caminho, perfil)).toBe(false)
    },
  )
})
