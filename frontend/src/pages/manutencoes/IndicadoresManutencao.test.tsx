// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IndicadoresManutencao } from './IndicadoresManutencao';
import { Manutencoes } from './Manutencoes';
import { estadoBusca, lerBusca, lerRecorte, rotaComRecorte } from './manutencoes.navegacao';
import type { Indicadores, FiltrosIndicadores } from '../../shared/services/manutencoes.service';

const filtros: FiltrosIndicadores = {veiculoId:'',tipo:'',inicio:'',fim:''};
const grupo = {total:0,limite:20,itens:[]} as const;
const resposta: Indicadores = {
  referencia:{instante:'2026-11-25T08:00:00Z',dataCivil:'2026-11-25',fuso:'America/Maceio'},
  filtros:{veiculoId:null,tipo:null},
  estoqueAtual:{veiculosEmManutencao:2,agendadas:3,emAndamento:4,atrasadas:0},
  periodo:{inicio:null,fim:null,fimExclusivo:null,criterioConcluidas:'CONCLUSAO_EFETIVA',criterioCusto:'ENTRADA_PLANEJADA',
    concluidas:5,custo:{totalConhecido:null,comCustoInformado:0,comCustoDesconhecido:0}},
  alertas:{preventivasProximos7Dias:{...grupo,itens:[],inicio:'2026-11-25',fimExclusivo:'2026-12-02'},atrasos:{...grupo,itens:[]}},
};
const montar = (revision = 0, aoPerderAcesso = vi.fn()) => <IndicadoresManutencao filtros={filtros} revisao={revision}
  rota={id=>'/admin/manutencoes/'+id} estado={null} aoPerderAcesso={aoPerderAcesso}/>;
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status});
const item = {id:'9007199254740993',veiculo:{id:'-111',placa:'S236-X'},tipo:'PREVENTIVA',status:'AGENDADA',
  entrada:'2026-11-25',conclusaoPrevista:'2026-11-26'} as const;

afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});

test('restaura filtros válidos, preserva BIGINT e vincula a busca exclusivamente à sessão',()=>{
  const r=lerRecorte('?veiculoId=9007199254740993&tipo=PREVENTIVA&status=AGENDADA&inicio=2026-11-25&fim=2026-11-01&q=ignorar&page=2');
  expect(r.filtros).toEqual({veiculoId:'9007199254740993',tipo:'PREVENTIVA',status:'AGENDADA',inicio:'2026-11-25',fim:'',q:''});
  expect(r.pagina).toBe(2);
  expect(rotaComRecorte('/admin/manutencoes',{...r.filtros,q:'privado'},r.pagina)).not.toContain('privado');
  const s=estadoBusca('sessao-1','prestador sintético');
  expect(lerBusca(s,'sessao-1')).toBe('prestador sintético');
  expect(lerBusca(s,'sessao-2')).toBe('');
  expect(lerRecorte('?page=2&page=3').pagina).toBe(1);
});

test('renderiza seis cards e remove integralmente o banner no zero confirmado',async()=>{
  sessionStorage.setItem('token','fixture-test');
  const data: Indicadores = {...resposta,alertas:{...resposta.alertas,
    preventivasProximos7Dias:{...resposta.alertas.preventivasProximos7Dias,total:27,itens:[item]}}};
  const request = vi.fn().mockResolvedValueOnce(json({data})).mockResolvedValueOnce(json({data:resposta}));
  vi.stubGlobal('fetch',request);
  const negar=vi.fn();
  const {rerender}=render(montar(0,negar));
  await screen.findByRole('region',{name:'Preventivas nos próximos 7 dias'});
  expect(screen.getAllByRole('article')).toHaveLength(6);
  expect(within(screen.getByRole('article',{name:'Veículos em manutenção'})).getByText('2')).toBeTruthy();
  expect(screen.getByRole('link',{name:/S236-X/}).getAttribute('href')).toBe('/admin/manutencoes/'+item.id);
  expect(screen.getByText('Exibindo 1 de 27 ocorrências.')).toBeTruthy();
  rerender(montar(1,negar));
  expect(screen.queryByRole('region',{name:'Preventivas nos próximos 7 dias'})).toBeNull();
  await screen.findByText('Sem ocorrências no recorte');
  expect(screen.queryByText('Preventivas nos próximos 7 dias')).toBeNull();
});

test('erro e DTO inválido permitem retry, sem converter indisponibilidade em zero',async()=>{
  sessionStorage.setItem('token','fixture-test');
  const request=vi.fn().mockResolvedValueOnce(json({error:{message:'Falha sintética'}},500))
    .mockResolvedValueOnce(json({data:{...resposta,estoqueAtual:{...resposta.estoqueAtual,agendadas:-1}}}))
    .mockResolvedValueOnce(json({data:resposta}));
  vi.stubGlobal('fetch',request);
  render(montar());
  await screen.findByRole('alert');
  expect(screen.queryByText('Sem ocorrências no recorte')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente os indicadores'}));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente os indicadores'}));
  await screen.findByText('Sem ocorrências no recorte');
});

test('expande atrasos pelo card e preserva a string de custo de alta precisão',async()=>{
  sessionStorage.setItem('token','fixture-test');
  const data: Indicadores = {...resposta,estoqueAtual:{...resposta.estoqueAtual,atrasadas:21},
    periodo:{...resposta.periodo,custo:{totalConhecido:'9007199254740993.000001',comCustoInformado:1,comCustoDesconhecido:5}},
    alertas:{...resposta.alertas,atrasos:{total:21,limite:20,itens:[item]}}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({data})));
  render(montar());
  const card=await screen.findByRole('button',{name:'Atrasadas: 21 ocorrências'});
  expect(card.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByText('R$ 9.007.199.254.740.993,000001')).toBeTruthy();
  expect(screen.getByText('1 com custo · 5 sem custo')).toBeTruthy();
  fireEvent.click(card);
  expect(card.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region',{name:'Ocorrências atrasadas'})).toBeTruthy();
});

test('mudar filtros aborta consulta antiga e 403 remove valores confirmados',async()=>{
  sessionStorage.setItem('token','fixture-test');
  let terminarAntiga: ((r:Response)=>void)|undefined;
  let sinal: AbortSignal | null | undefined;
  const negar=vi.fn();
  const request=vi.fn()
    .mockImplementationOnce((_input:unknown,init:RequestInit)=>{
      sinal=init.signal;
      return new Promise<Response>(resolve=>{terminarAntiga=resolve;});
    }).mockResolvedValueOnce(json({data:{...resposta,periodo:{...resposta.periodo,custo:{
      totalConhecido:'0.000',comCustoInformado:1,comCustoDesconhecido:0}}}}))
    .mockResolvedValueOnce(json({error:{code:'ACESSO_NEGADO',message:'Acesso negado'}},403));
  vi.stubGlobal('fetch',request);
  const props={revisao:0,rota:(id:string)=>'/admin/manutencoes/'+id,estado:null,aoPerderAcesso:negar};
  const {rerender}=render(<IndicadoresManutencao {...props} filtros={filtros}/>);
  await vi.waitFor(()=>expect(terminarAntiga).toBeDefined());
  rerender(<IndicadoresManutencao {...props} filtros={{...filtros,tipo:'PREVENTIVA'}}/>);
  expect(sinal?.aborted).toBe(true);
  await screen.findByText('R$ 0,00',{exact:true});
  terminarAntiga?.(json({data:resposta}));
  expect(screen.queryByText('Sem ocorrências no recorte')).toBeNull();
  rerender(<IndicadoresManutencao {...props} revisao={1} filtros={{...filtros,tipo:'PREVENTIVA'}}/>);
  await screen.findByRole('alert');
  expect(negar).toHaveBeenCalledOnce();
  expect(screen.queryByText('R$ 0,00',{exact:true})).toBeNull();
});

test('falha da listagem mantém indicadores e retry só consulta a lista',async()=>{
  sessionStorage.setItem('token','fixture-test');
  let consultasPainel=0, consultasLista=0;
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(input:unknown)=>{
    const caminho=new URL(String(input),'http://127.0.0.1').pathname;
    if (caminho==='/api/manutencoes/indicadores') {
      consultasPainel++;
      return json({data:resposta});
    }
    if (caminho==='/api/veiculos') return json({data:[]});
    consultasLista++;
    return consultasLista===1 ? json({error:{message:'Lista indisponível'}},500)
      : json({data:[],meta:{page:1,limit:20,total:0}});
  }));
  render(<Manutencoes base="/admin/manutencoes"/>);
  await screen.findByText('Lista indisponível');
  await screen.findByRole('region',{name:'Indicadores de manutenção'});
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
  await screen.findByText('Nenhuma manutenção registrada.');
  expect(consultasPainel).toBe(1);
});
