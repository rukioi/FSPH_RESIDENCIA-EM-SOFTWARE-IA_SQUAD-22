import { expect, test } from 'vitest';
import {
  consultaSvoFiltroSolicitacoes, consultaSvoFiltroOrdens,
  consultaSvoPaginacao, parsePaginacao,
} from '../../src/modules/svo/svo.consultas.schemas.js';
import { operations, routePattern } from '../../src/shared/contract/registry.js';

test('SCRUM-146: consulta civil válida e rejeita data impossível ou intervalo invertido', () => {
  expect(consultaSvoFiltroSolicitacoes.safeParse({ inicio:'2024-02-29', fim:'2024-03-01' }).success).toBe(true);
  expect(consultaSvoFiltroSolicitacoes.safeParse({ inicio:'2025-02-29' }).success).toBe(false);
  expect(consultaSvoFiltroSolicitacoes.safeParse({ inicio:'2026-11-05', fim:'2026-11-04' }).success).toBe(false);
  expect(consultaSvoFiltroSolicitacoes.safeParse({ status:'CONFIRMADA_SVO', page:'1', limit:'20' }).success).toBe(true);
  expect(consultaSvoFiltroSolicitacoes.safeParse({ status:'CONFIRMADA_SVO', desconhecido:'x' }).success).toBe(false);
});

test('SCRUM-146: paginação preserva precisão e limita requisições', () => {
  expect(parsePaginacao(consultaSvoPaginacao.parse({}))).toEqual({ page:1, limit:20, offset:0 });
  expect(parsePaginacao(consultaSvoPaginacao.parse({ page:'3',limit:'10' }))).toEqual({page:3,limit:10,offset:20});
  expect(parsePaginacao(consultaSvoPaginacao.parse({page:'1',limit:'101'}))).toBeNull();
  expect(consultaSvoPaginacao.safeParse({page:'0'}).success).toBe(false);
  expect(parsePaginacao(consultaSvoPaginacao.parse({page:'9007199254740992'}))).toBeNull();
  expect(consultaSvoFiltroOrdens.safeParse({status:'STATUS_INVENTADO'}).success).toBe(false);
});

test('SCRUM-146: seis operações novas não substituem os endpoints legados', () => {
  const ids = [
    '/api/svo/solicitacoes/paginadas', '/api/svo/solicitacoes/{id}',
    '/api/svo/solicitacoes/{id}/historico', '/api/svo/ordens-coleta/paginadas',
    '/api/svo/ordens-coleta/{id}', '/api/svo/ordens-coleta/{id}/historico',
  ];
  for (const path of ids) {
    const itens = operations.filter(o => o.modulo==='svo' && o.method==='get' && o.path===path);
    expect(itens).toHaveLength(1);
    expect(itens[0]?.perfis).toEqual(['ATENDENTE_SVO']);
    expect(routePattern(itens[0]!).test(path.replace('{id}', '10'))).toBe(true);
  }
  expect(operations.filter(o => o.path==='/api/svo/solicitacoes' && o.method==='get')).toHaveLength(1);
  expect(operations.filter(o => o.path==='/api/svo/ordens-coleta' && o.method==='get')).toHaveLength(1);
});
