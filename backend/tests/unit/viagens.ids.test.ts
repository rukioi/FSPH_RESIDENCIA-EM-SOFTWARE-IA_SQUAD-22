import { beforeEach, expect, test, vi } from 'vitest';
const mocks=vi.hoisted(()=>({detalhar:vi.fn()}));
vi.mock('../../src/database/connection.js',()=>({sql:{}}));
vi.mock('../../src/modules/viagens/viagens.repository.js',()=>({detalharViagem:mocks.detalhar}));
import {detalhes} from '../../src/modules/viagens/viagens.service.js';
import {operations,routePattern} from '../../src/shared/contract/registry.js';
import {openapi} from '../../src/shared/contract/openapi.js';
const usuario={id:'42',nome:'Gestor',email:'gestor@example.invalid',perfil:'GESTOR_FROTA' as const};
beforeEach(()=>{mocks.detalhar.mockReset();mocks.detalhar.mockRejectedValue(new Error('consulta atingida'));});
test.each(['-27001','-9223372036854775808','9223372036854775807'])('aceita ID de viagem BIGINT assinado %s',async id=>{
  await expect(detalhes(id,usuario)).rejects.toThrow('consulta atingida');
  expect(mocks.detalhar).toHaveBeenCalledWith(id,null);
});
test.each(['-9223372036854775809','9223372036854775808','abc'])('rejeita ID invalido %s',async id=>{
  await expect(detalhes(id,usuario)).rejects.toMatchObject({status:400});
  expect(mocks.detalhar).not.toHaveBeenCalled();
});
test('registro de rotas reconhece ID negativo apenas para viagens',()=>{
  const viagem=operations.find(o=>o.modulo==='viagens'&&o.path==='/api/viagens/{id}')!;
  const usuarioOp=operations.find(o=>o.modulo==='usuarios'&&o.path.includes('{id}'))!;
  expect(routePattern(viagem).test('/api/viagens/-27001')).toBe(true);
  expect(routePattern(usuarioOp).test(usuarioOp.path.replace('{id}','-1'))).toBe(false);
});

test('OpenAPI descreve identificador assinado para viagem',()=>{
  const doc=openapi();
  const operacao=doc.paths['/api/viagens/{id}'].get as {parameters:Array<{name:string;schema:{pattern:string}}>};
  expect(operacao.parameters.find(p=>p.name==='id')?.schema.pattern).toBe('^-?[0-9]+$');
});
