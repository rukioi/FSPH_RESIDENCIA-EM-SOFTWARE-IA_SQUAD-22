import { describe, expect, it } from 'vitest'
import { filtrosDaAba, situacaoDocumento } from './documentos.apresentacao'

describe('situação documental', () => {
  it('marca como vencido somente quando o backend informa dias negativos', () => {
    expect(situacaoDocumento({ diasRestantes: -1, regular: false })).toBe(
      'VENCIDO',
    )
  })

  it('identifica o dia do vencimento informado pelo backend', () => {
    expect(situacaoDocumento({ diasRestantes: 0, regular: false })).toBe('HOJE')
  })

  it('usa o indicador de regularidade do backend para validades futuras', () => {
    expect(situacaoDocumento({ diasRestantes: 45, regular: true })).toBe(
      'REGULAR',
    )
  })

  it('não transforma 30 dias em uma regra local de alerta', () => {
    expect(situacaoDocumento({ diasRestantes: 15, regular: false })).toBe(
      'A_VENCER',
    )
    expect(situacaoDocumento({ diasRestantes: 45, regular: false })).toBe(
      'A_VENCER',
    )
  })
})

describe('filtros das abas', () => {
  it('envia A_VENCER sem inventar uma janela de dias', () => {
    expect(filtrosDaAba('A_VENCER', { veiculoId: '12', page: 3 })).toEqual({
      veiculoId: '12',
      situacao: 'A_VENCER',
    })
  })

  it('separa documentos de veículos e CNHs pelo contrato da API', () => {
    expect(filtrosDaAba('VEICULOS')).toEqual({ tipo: 'DOCUMENTO_VEICULO' })
    expect(filtrosDaAba('MOTORISTAS')).toEqual({ tipo: 'CNH_MOTORISTA' })
  })
})
