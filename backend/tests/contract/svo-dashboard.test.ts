import { expect, test } from 'vitest';
import { filtroDashboardSvo, filtroAtividadesSvo, parseLimiteAtividades } from '../../src/modules/svo/svo.dashboard.schemas.js';
import { operations } from '../../src/shared/contract/registry.js';

test('SCRUM-149: períodos aceitos e parâmetros inválidos rejeitados', () => {
  expect(filtroDashboardSvo.parse({}).periodo).toBe('hoje');
  expect(filtroDashboardSvo.parse({periodo:'7d'}).periodo).toBe('7d');
  expect(filtroDashboardSvo.parse({periodo:'30d'}).periodo).toBe('30d');
  expect(filtroDashboardSvo.safeParse({periodo:'amanha'}).success).toBe(false);
  expect(filtroDashboardSvo.safeParse({qualquer:'x'}).success).toBe(false);
});

test('SCRUM-149: atividade recente limita resultado sem truncar silenciosamente', () => {
  expect(parseLimiteAtividades(filtroAtividadesSvo.parse({}).limite)).toBe(10);
  expect(parseLimiteAtividades(filtroAtividadesSvo.parse({limite:'50'}).limite)).toBe(50);
  expect(parseLimiteAtividades(filtroAtividadesSvo.parse({limite:'51'}).limite)).toBeNull();
  expect(filtroAtividadesSvo.safeParse({limite:'0'}).success).toBe(false);
});

test('SCRUM-149: dashboard operacional SVO exclusivo do atendente', () => {
  for(const path of ['/api/svo/dashboard','/api/svo/dashboard/filas','/api/svo/dashboard/atividades']){
    const itens=operations.filter(o=>o.method==='get'&&o.path===path);
    expect(itens).toHaveLength(1);
    expect(itens[0]?.perfis).toEqual(['ATENDENTE_SVO']);
  }
});
