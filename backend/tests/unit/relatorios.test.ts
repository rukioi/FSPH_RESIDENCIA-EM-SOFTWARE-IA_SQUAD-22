import { beforeEach, expect, test, vi } from 'vitest';
vi.mock('../../src/modules/relatorios/relatorios.repository.js',()=>({consultarLinhasRelatorio:vi.fn()}));
import { consultarLinhasRelatorio } from '../../src/modules/relatorios/relatorios.repository.js';
import { gerarRelatorio, validarConsultaRelatorio } from '../../src/modules/relatorios/relatorios.service.js';

const base = 'tipo=viagens&inicio=2026-01-01&fim=2026-01-31';
beforeEach(()=>vi.mocked(consultarLinhasRelatorio).mockReset());
test.each([
  '&veiculoId=abc', '&motoristaId=1 OR 1=1', '&veiculoId=9223372036854775808', '&veiculoId=0',
  '&veiculoId=-1','&veiculoId=1.1','&veiculoId=', '&status=OUTRO', '&extra=1','&tipo=viagens', '&status=',
])('recusa entrada inválida com erro HTTP seguro: %s',extra=>{
  expect(()=>validarConsultaRelatorio(new URLSearchParams(base+extra))).toThrow(expect.objectContaining({status:400,code:'DADOS_INVALIDOS'}));
});
test.each([
  'tipo=viagens&inicio=2026-02-30&fim=2026-03-01',
  'tipo=viagens&inicio=2026-02-01&fim=2026-01-01',
  'tipo=viagens&inicio=2026-01-01&fim=2027-01-02',
  'tipo=viagens&inicio=0000-01-01&fim=0000-01-02',
])('valida calendário e janela inclusiva: %s',query=>expect(()=>validarConsultaRelatorio(new URLSearchParams(query))).toThrow(expect.objectContaining({status:400})));
test('aceita dia único e preserva BIGINT sem perda',()=>{
  expect(validarConsultaRelatorio(new URLSearchParams('tipo=veiculos&inicio=2026-01-01&fim=2026-01-01&veiculoId=9223372036854775807')).veiculoId).toBe('9223372036854775807');
});
test('separa SVO dos relatórios institucionais e recusa status sem suporte',()=>{
  expect(()=>validarConsultaRelatorio(new URLSearchParams(base),true)).toThrow();
  expect(()=>validarConsultaRelatorio(new URLSearchParams(base.replace('viagens','svo')))).toThrow();
  expect(validarConsultaRelatorio(new URLSearchParams('inicio=2026-01-01&fim=2026-01-02'),true).tipo).toBe('svo');
  expect(()=>validarConsultaRelatorio(new URLSearchParams(base.replace('viagens','abastecimentos')+'&status=CONCLUIDA'))).toThrow();
});
test('soma só km concluídos informados e mantém ausências distintas de zero',async()=>{
  vi.mocked(consultarLinhasRelatorio).mockResolvedValue([
    {id:'1',status:'CONCLUIDA',kmPercorridos:40}, {id:'2',status:'CONCLUIDA',kmPercorridos:0},
    {id:'3',status:'CONCLUIDA',kmPercorridos:null}, {id:'4',status:'AGENDADA',kmPercorridos:null},
  ] as never);
  const {data} = await gerarRelatorio(validarConsultaRelatorio(new URLSearchParams(base)));
  expect(data.resumo).toEqual({registros:4,kmConcluidos:40,semQuilometragem:1});
  expect(data.linhas[2].kmPercorridos).toBeNull();
});
test('resultado vazio ou sem odômetro não inventa quilometragem zero',async()=>{
  vi.mocked(consultarLinhasRelatorio).mockResolvedValue([] as never);
  expect((await gerarRelatorio(validarConsultaRelatorio(new URLSearchParams(base)))).data.resumo).toMatchObject({registros:0,kmConcluidos:null,semQuilometragem:0});
});
test('recusa resultado grande sem truncar silenciosamente a exportação',async()=>{
  vi.mocked(consultarLinhasRelatorio).mockResolvedValue(Array.from({length:5001},()=>({})) as never);
  await expect(gerarRelatorio(validarConsultaRelatorio(new URLSearchParams(base)))).rejects.toMatchObject({status:422,code:'RELATORIO_MUITO_GRANDE'});
});
test('ocorrências deixam explícita a cobertura e omitem campos não selecionados',async()=>{
  vi.mocked(consultarLinhasRelatorio).mockResolvedValue([{id:'1',justificativa:'Ajuste registrado',cpf:'privado',dados:'privado'}] as never);
  const {data} = await gerarRelatorio(validarConsultaRelatorio(new URLSearchParams(base.replace('viagens','ocorrencias'))));
  expect(data.observacoes.join(' ')).toMatch(/não possuem cadastro estruturado/);
  expect(JSON.stringify(data)).not.toContain('privado');
});
