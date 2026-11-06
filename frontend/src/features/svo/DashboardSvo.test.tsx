import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Svo } from './Svo'
import { OrdensColetaRecentes } from './OrdensColetaRecentes'
import { GraficoAtendimentos } from './GraficoAtendimentos'
import { dataCivilSvo } from './apresentacaoSvo'

describe('dashboard SVO aguarda agregações oficiais', () => {
  it('não apresenta contadores de sessão nem gráfico ilustrativo como indicadores', () => {
    const html = renderToStaticMarkup(<Svo />)
    expect(html).not.toContain('Dados ilustrativos')
    expect(html).not.toContain('Confirmados nesta sessão')
    expect(html).toContain('Carregando indicadores')
    expect(html).toContain('Carregando atividades')
    expect(html).toContain('Carregando ordens')
    expect(html).not.toContain('Nenhuma ordem aguardando despacho')
  })
})

it('distribuição vazia real não produz rosca fictícia nem divisão por zero',()=>{
  const html=renderToStaticMarkup(<GraficoAtendimentos dados={{aguardandoTriagem:0,confirmadasSvo:0,encaminhadasIml:0,semClassificacao:0}}/>)
  expect(html).toContain('Nenhuma solicitação criada no período')
  expect(html).not.toMatch(/NaN|Infinity|conic-gradient/)
  const indisponivel=renderToStaticMarkup(<GraficoAtendimentos dados={null}/>)
  expect(indisponivel).toContain('Distribuição indisponível')
  expect(indisponivel).not.toContain('Nenhuma solicitação')
})
it('datas civis preservam hora, data e nulidade sem conversão UTC',()=>{
  expect(dataCivilSvo('2026-11-05T00:01:02.123456')).toBe('05/11/2026, 00:01:02')
  expect(dataCivilSvo('2026-11-05')).toBe('05/11/2026')
  expect(dataCivilSvo(null)).toBe('Não informada')
  expect(dataCivilSvo('2026-11-05T00:01:02Z')).toBe('Data indisponível')
})

it('apresenta despacho confirmado no estado EM_DESLOCAMENTO do contrato vigente', () => {
  const html = renderToStaticMarkup(<OrdensColetaRecentes loading={false} error="" retry={() => {}} data={{
    data: [{ id: '1', codigo: '#OC-1', solicitacaoId: '1', solicitacaoCodigo: '#SVO-1', status: 'EM_DESLOCAMENTO', quantidadeCorpos: 1 }],
    meta: { page: 1, limit: 20, total: 1 }
  }} />)
  expect(html).toContain('Em deslocamento')
  expect(html).not.toContain('Pronta para iniciar')
})
