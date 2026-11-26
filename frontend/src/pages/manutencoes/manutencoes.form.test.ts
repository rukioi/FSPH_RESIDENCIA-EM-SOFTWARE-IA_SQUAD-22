import { describe, expect, it } from 'vitest';
import { lerRotaDetalheVeiculo, lerRotaManutencao, ROTAS } from '../../app/routes/rotas';
import { perfilPodeAcessar } from '../../shared/services/access.service';
import { consultaManutencoes, filtrosIniciais, idValido, type Detalhe } from '../../shared/services/manutencoes.service';
import { abrirRascunho, acoesPorEstado, converterInstante, dataPt, dinheiro, prepararFormulario, reconciliar } from './manutencoes.form';

const detalhe: Detalhe = {
  id:'9007199254740993', veiculo:{id:'-27003',placa:'S235',vinculo:'PROPRIO'}, tipo:'PREVENTIVA', descricao:'Revisão',
  status:'CONCLUIDA', entrada:'2026-11-24', conclusaoPrevista:'2026-11-25', quilometragem:0, prestador:null,
  custo:'0', observacoes:null, atrasada:false, iniciadaEm:'2026-11-24T14:00:00.123456Z',
  concluidaEm:'2026-11-24T15:00:00.234567Z', canceladaEm:null, criadoEm:'2026-11-24T13:00:00Z',
  atualizadoEm:'2026-11-24T15:00:00Z',versao:'"'+'x'.repeat(36)+'"',
};

describe('rotas e filtros',()=>{
  it('preserva IDs, limita BIGINT e separa os perfis',()=>{
    expect(idValido('9223372036854775807')).toBe(true);
    expect(idValido('9223372036854775808')).toBe(false);
    expect(idValido('-9223372036854775808')).toBe(true);
    expect(idValido('-9223372036854775809')).toBe(false);
    expect(lerRotaManutencao('/admin/manutencoes/9007199254740993')).toEqual({base:ROTAS.manutencoesAdm,id:detalhe.id});
    expect(lerRotaManutencao('/gestor/manutencoes/-23501')).toEqual({base:ROTAS.manutencoesGestor,id:'-23501'});
    expect(lerRotaManutencao('/admin/manutencoes/1/editar')).toBeNull();
    expect(lerRotaDetalheVeiculo('/gestor/veiculos/-23501')).toBe('-23501');
    expect(perfilPodeAcessar('/admin/manutencoes/1','ADM')).toBe(true);
    expect(perfilPodeAcessar('/admin/manutencoes/1','GESTOR_FROTA')).toBe(false);
    expect(perfilPodeAcessar('/gestor/manutencoes','GESTOR_FROTA')).toBe(true);
    expect(perfilPodeAcessar('/gestor/manutencoes','ATENDENTE_SVO')).toBe(false);
    expect(perfilPodeAcessar('/gestor/veiculos/9007199254740993','ADM')).toBe(true);
    expect(perfilPodeAcessar('/gestor/veiculos/-23501','MOTORISTA')).toBe(false);
  });
  it('serializa filtros combinados e ignora valores vazios',()=>{
    expect(Object.fromEntries(consultaManutencoes(2,{...filtrosIniciais,veiculoId:'-23501',tipo:'CORRETIVA',q:' %_  ',fim:'2026-12-01'})))
      .toEqual({page:'2',limit:'20',veiculoId:'-23501',tipo:'CORRETIVA',fim:'2026-12-01',q:'%_'});
  });
});

describe('formulário e revisão',()=>{
  it('preserva a precisão decimal e distingue não informado de zero',()=>{
    expect(dinheiro(null)).toBe('Não informado');
    expect(dinheiro('0')).toBe('R$ 0,00');
    expect(dinheiro('9007199254740993.007')).toBe('R$ 9.007.199.254.740.993,007');
    const r = abrirRascunho(detalhe);
    expect(prepararFormulario({...r,custo:''},detalhe).edicao).toEqual({custo:null});
    expect(prepararFormulario({...r,custo:'1.234'},detalhe).erros.custo).toBeTruthy();
    expect(prepararFormulario({...r,custo:'1e4'},detalhe).erros.custo).toBeTruthy();
    expect(prepararFormulario({...r,custo:'9007199254740993,007'},detalhe).edicao).toEqual({custo:'9007199254740993.007'});
  });
  it('valida calendário, janela, textos e quilometragem',()=>{
    const r = abrirRascunho(detalhe);
    expect(dataPt('2026-11-25')).toBe('25/11/2026');
    expect(prepararFormulario({...r,entrada:'2026-02-29'},detalhe).erros.entrada).toBeTruthy();
    expect(prepararFormulario({...r,conclusaoPrevista:'2026-11-23'},detalhe).erros.conclusaoPrevista).toBeTruthy();
    expect(prepararFormulario({...r,quilometragem:'1.5'},detalhe).erros.quilometragem).toBeTruthy();
    expect(prepararFormulario({...r,quilometragem:'2147483648'},detalhe).erros.quilometragem).toBeTruthy();
    expect(prepararFormulario({...r,descricao:'a'.repeat(2001),prestador:'a'.repeat(256),observacoes:'a'.repeat(2001)},detalhe).erros)
      .toMatchObject({descricao:expect.any(String),prestador:expect.any(String),observacoes:expect.any(String)});
  });
  it('preserva campos omitidos, veículo e precisão operacional',()=>{
    const r = abrirRascunho(detalhe);
    expect(prepararFormulario({...r,veiculoId:'1'},detalhe).edicao).toEqual({});
    expect(prepararFormulario({...r,concluidaEm:'2026-11-24 13:00:00,123456'},detalhe).edicao)
      .toEqual({concluidaEm:'2026-11-24T16:00:00.123456Z'});
    expect(converterInstante('2026-11-24 12:00')).toBe('2026-11-24T15:00:00.000000Z');
    expect(converterInstante('2026-02-30 08:00')).toBeNull();
    expect(prepararFormulario({...r,concluidaEm:'2026-11-24 09:00'},detalhe).erros.concluidaEm).toBeTruthy();
  });
  it('permite início imediato somente para corretiva e aplica a matriz de transições',()=>{
    const r = {...abrirRascunho(detalhe),iniciarImediatamente:true};
    expect(prepararFormulario(r).entrada.iniciarImediatamente).toBeUndefined();
    expect(prepararFormulario({...r,tipo:'CORRETIVA'}).entrada.iniciarImediatamente).toBe(true);
    expect(acoesPorEstado).toEqual({AGENDADA:['INICIAR','CANCELAR'], EM_ANDAMENTO:['CONCLUIR'], CONCLUIDA:['REABRIR'], CANCELADA:['REATIVAR']});
  });
  it('mescla somente os campos alterados pelo usuário',()=>{
    const base = abrirRascunho(detalhe);
    const digitado = {...base,descricao:'Minha descrição'};
    const atual = {...base,descricao:'Descrição concorrente',custo:'1,05'};
    expect(reconciliar(base,digitado,atual)).toMatchObject({descricao:'Minha descrição',custo:'1,05'});
  });
});
