// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Manutencoes } from './Manutencoes';

const veiculo={id:'9007199254740993',placa:'S235001',vinculo:'PROPRIO',marca:'Fixture',modelo:'Teste',
  ano:2026,tipo:'PASSEIO',capacidade_obitos:0,quilometragem_atual:0,status:'EM_MANUTENCAO',is_svo:false,
  criado_em:null,capacidade_passageiros:5,fornecedor_locacao:null};
const resumo={id:'-23501',veiculo:{id:veiculo.id,placa:veiculo.placa,vinculo:veiculo.vinculo},
  tipo:'PREVENTIVA',descricao:'Revisão de teste',status:'AGENDADA',entrada:'2026-11-24',
  conclusaoPrevista:'2026-11-26',prestador:null,custo:null,atrasada:false};
const versao='"'+'a'.repeat(36)+'"';
const detalhe={...resumo,quilometragem:12000,observacoes:null,iniciadaEm:null,concluidaEm:null,canceladaEm:null,
  criadoEm:'2026-11-24T14:00:00.123456Z',atualizadoEm:'2026-11-24T14:00:00.123456Z',versao};
const lista=(data:unknown[]=[])=>({data,meta:{page:1,limit:20,total:data.length}});
const json=(data: unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const url=(input:unknown)=>new URL(String(input),'http://127.0.0.1');
const falha=(status:number,code:string,message:string,fields?:Record<string,string>)=>json({error:{code,message,fields}},status);
const transporte=vi.fn<(input:unknown,init?:RequestInit)=>Promise<Response>>();

beforeEach(()=>{
  sessionStorage.setItem('token','fixture-frontend');
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open',''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLElement.prototype.showPopover = function () { this.setAttribute('data-aberto','true'); };
  HTMLElement.prototype.hidePopover = function () { this.removeAttribute('data-aberto'); };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch',transporte);
});

afterEach(()=>{
  cleanup();
  sessionStorage.clear();
  transporte.mockReset();
  vi.unstubAllGlobals();
});

test('aborta buscas antigas e mantém o resultado mais recente mesmo quando a leitura anterior resolve por último',async()=>{
  let resolver: ((r:Response)=>void)|undefined;
  let signal: AbortSignal | null | undefined;
  transporte.mockImplementation(async(input,init)=>{
    const path=url(input);
    if(path.pathname==='/api/veiculos') return json({data:[veiculo]});
    const q=path.searchParams.get('q');
    if(q==='primeira') {signal=init?.signal;return new Promise(resolve=>{resolver=resolve;});}
    if(q==='segunda') return json(lista([{...resumo,descricao:'Resultado mais novo'}]));
    return json(lista());
  });
  render(<Manutencoes base="/admin/manutencoes"/>);
  await screen.findByText('Nenhuma manutenção registrada.');
  const busca=screen.getByRole('searchbox',{name:'Buscar'});
  fireEvent.change(busca,{target:{value:'primeira'}});
  await waitFor(()=>expect(resolver).toBeDefined());
  fireEvent.change(busca,{target:{value:'segunda'}});
  await screen.findByText('Resultado mais novo');
  expect(signal?.aborted).toBe(true);
  await act(async()=>resolver?.(json(lista([{...resumo,descricao:'Resposta antiga'}]))));
  expect(screen.queryByText('Resposta antiga')).toBeNull();
});

test.each([403,404,500])('falha HTTP %s não aparece como lista vazia e permite repetir a leitura',async status=>{
  let n=0;
  transporte.mockImplementation(async(input)=>{
    if(url(input).pathname==='/api/veiculos') return json({data:[]});
    if(url(input).pathname==='/api/manutencoes/indicadores') return new Promise<Response>(()=>{ /* consulta independente */ });
    return ++n===1 ? falha(status,'FALHA_TESTE','Consulta indisponível') : json(lista());
  });
  render(<Manutencoes base="/admin/manutencoes"/>);
  await screen.findByRole('alert');
  expect(screen.queryByText('Nenhuma manutenção registrada.')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
  await screen.findByText('Nenhuma manutenção registrada.');
});

test('edição envia If-Match intacto, impede reentrada e preserva valores com erro de campo',async()=>{
  let resolver: ((r:Response)=>void)|undefined;
  const gravar=vi.fn<(init:RequestInit|undefined)=>void>();
  const base='/admin/manutencoes';
  transporte.mockImplementation(async(input,init)=>{
    const path=url(input).pathname;
    if(path==='/api/veiculos') return json({data:[veiculo]});
    if(path.endsWith('/historico')) return json(lista());
    if(init?.method==='PATCH') {gravar(init);return new Promise(resolve=>{resolver=resolve;});}
    return json({data:detalhe});
  });
  render(<Manutencoes base={base} id={detalhe.id}/>);
  await screen.findByRole('heading',{name:'Manutenção do veículo S235001'});
  fireEvent.click(screen.getByRole('button',{name:'Editar'}));
  const modal=await screen.findByRole('dialog',{name:'Editar manutenção'});
  const descricao=await within(modal).findByLabelText('Descrição do serviço');
  fireEvent.change(descricao,{target:{value:'Descrição alterada'}});
  const form=descricao.closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(()=>expect(gravar).toHaveBeenCalledTimes(1));
  const init=gravar.mock.calls[0][0];
  expect(new Headers(init?.headers).get('If-Match')).toBe(versao);
  expect(JSON.parse(String(init?.body))).toEqual({descricao:'Descrição alterada'});
  await act(async()=>resolver?.(falha(400,'DADOS_INVALIDOS','Revise a descrição',{descricao:'Descrição inválida'})));
  await within(modal).findByText('Descrição inválida');
  expect((descricao as HTMLInputElement).value).toBe('Descrição alterada');
  expect(descricao.getAttribute('aria-invalid')).toBe('true');
});

test('resposta de detalhe com versão inválida não renderiza ações',async()=>{
  transporte.mockImplementation(async(input)=>url(input).pathname==='/api/veiculos'
    ? json({data:[]}) : json({data:{...detalhe,versao:'invalida'}}));
  render(<Manutencoes base="/admin/manutencoes" id={detalhe.id}/>);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button',{name:'Editar'})).toBeNull();
});

test('retira o detalhe e o formulário quando a API revoga acesso durante a edição',async()=>{
  transporte.mockImplementation(async(input,init)=>{
    const path=url(input).pathname;
    if(path==='/api/veiculos') return json({data:[veiculo]});
    if(path.endsWith('/historico')) return json(lista());
    if(init?.method==='PATCH') return falha(403,'ACESSO_NEGADO','Acesso negado');
    return json({data:detalhe});
  });
  render(<Manutencoes base="/admin/manutencoes" id={detalhe.id}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Editar'}));
  const modal=await screen.findByRole('dialog',{name:'Editar manutenção'});
  const descricao=await within(modal).findByLabelText('Descrição do serviço');
  fireEvent.change(descricao,{target:{value:'Novo rascunho'}});
  fireEvent.submit(descricao.closest('form')!);
  await screen.findByText('Você não tem mais acesso a esta manutenção.');
  expect(screen.queryByText(resumo.descricao)).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('estado incompatível revalida ações e não repete a transição',async()=>{
  let tentativas=0;
  transporte.mockImplementation(async(input,init)=>{
    const path=url(input).pathname;
    if(path==='/api/veiculos') return json({data:[veiculo]});
    if(path.endsWith('/historico')) return json(lista());
    if(init?.method==='PATCH') {
      tentativas++;
      return falha(409,'ESTADO_INCOMPATIVEL','Transição incompatível');
    }
    return json({data:tentativas ? {...detalhe,status:'CONCLUIDA',versao:'"'+ 'b'.repeat(36)+'"'} : detalhe});
  });
  render(<Manutencoes base="/admin/manutencoes" id={detalhe.id}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Iniciar manutenção'}));
  const modal=await screen.findByRole('dialog',{name:'Iniciar manutenção'});
  fireEvent.click(await within(modal).findByRole('button',{name:'Confirmar'}));
  await within(modal).findByText('Estado atual: Concluída.');
  fireEvent.click(within(modal).getByRole('button',{name:'Revisar com os dados atuais'}));
  expect(within(modal).getByText('A ação não é compatível com o estado atual.',{exact:false})).toBeTruthy();
  expect((within(modal).getByRole('button',{name:'Confirmar'}) as HTMLButtonElement).disabled).toBe(true);
  expect(tentativas).toBe(1);
});

test('seletor integrado pesquisa o catálogo e seleciona por teclado sem alterar custo ou status',async()=>{
  transporte.mockImplementation(async(input)=>{
    const caminho=url(input).pathname;
    if(caminho==='/api/veiculos') return json({data:[veiculo,{...veiculo,id:'-27200',placa:'TMP2351',modelo:'Modelo Único'}]});
    return json(lista());
  });
  render(<Manutencoes base="/admin/manutencoes"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Registrar manutenção'}));
  const modal=await screen.findByRole('dialog',{name:'Registrar manutenção'});
  const seletor=within(modal).getByRole('combobox',{name:'Veículo'});
  await waitFor(()=>expect((seletor as HTMLInputElement).disabled).toBe(false));
  expect(seletor.getAttribute('aria-required')).toBe('true');
  expect(within(modal).queryByRole('searchbox')).toBeNull();
  fireEvent.click(seletor);
  fireEvent.change(seletor,{target:{value:'modelo unico'}});
  expect(within(modal).getAllByRole('option',{name:/TMP2351/})).toHaveLength(1);
  fireEvent.keyDown(seletor,{key:'ArrowDown'});
  fireEvent.keyDown(seletor,{key:'Enter'});
  expect((seletor as HTMLInputElement).value).toContain('TMP2351');
  expect(within(modal).queryByRole('listbox')).toBeNull();
  expect((within(modal).getByLabelText('Custo (R$)') as HTMLInputElement).value).toBe('');
  expect((within(modal).getByLabelText('Status') as HTMLInputElement).readOnly).toBe(true);
  expect(within(modal).getByLabelText('Descrição do serviço').hasAttribute('required')).toBe(true);
  expect(within(modal).getByLabelText('Prestador responsável').hasAttribute('required')).toBe(false);
});
