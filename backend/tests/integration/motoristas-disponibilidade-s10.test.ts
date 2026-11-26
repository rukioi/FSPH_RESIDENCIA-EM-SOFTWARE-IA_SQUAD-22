import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt, type PerfilUsuario } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { motoristasDisponibilidadeSchemas as schemas } from '../../src/modules/motoristas/motoristas.disponibilidade.schemas.js';
import { dashboardConsolidadoSchemas } from '../../src/modules/dashboard/dashboard.consolidado.schemas.js';
import { respostaDisponibilidade } from '../../src/modules/solicitacoes/solicitacoes.schemas.js';

// SCRUM-220: IDs reservados 72200xx/72201xx/72202xx; limpeza restrita a eles.
const sql = await verifiedSql();
const admin = await verifiedSql(true);
const server = createApp();
const atores: Record<string, [number, PerfilUsuario]> = { adm: [7220001, 'ADM'], gestor: [7220002, 'GESTOR_FROTA'],
  svo: [7220003, 'ATENDENTE_SVO'], condutor: [7220004, 'MOTORISTA'], solicitante: [7220005, 'SOLICITANTE_INTERNO'],
  condutorSvo: [7220006, 'MOTORISTA'] };
const M = '7220101', MSVO = '7220102', V = '7220201', VSVO = '7220202', ORDEM = 7220301;
const tokens: Record<string, string> = {};
let base = '', criado = false;

beforeAll(async () => {
  await sql.begin(async tx => {
    for (const [, [id, perfil]] of Object.entries(atores)) {
      await tx`INSERT INTO public.usuario (id,nome,email,senha_hash,perfil,ativo)
        VALUES (${id},'Fixture S10 disponibilidade',${`s10-disp-${id}@example.invalid`},'sem-login',${perfil},true)`;
    }
    await tx`INSERT INTO public.motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
      (7220101,7220004,'Condutor S10 fictício','S10-DISP-7220101','D','2099-12-31','DISPONIVEL'),
      (7220102,7220006,'Condutor SVO S10 fictício','S10-DISP-7220102','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES
      (7220201,'S10D201','Fixture','Disponibilidade',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,is_svo,vinculo,capacidade_obitos,capacidade_passageiros) VALUES
      (7220202,'S10D202','CHEVROLET','S10 TESTE',2026,'RABECÃO_SVO','DISPONIVEL',true,'PROPRIO',4,2)`;
    await tx`INSERT INTO public.solicitacao_obito (id,codigo,atendente_id,local_falecimento,endereco_remocao,solicitante_nome,
      status_triagem,triado_por_id,triado_em) VALUES (7220301,'#SVO-7220301',7220003,'Unidade fictícia','Rua fictícia',
      'Pessoa fictícia','CONFIRMADA_SVO',7220003,timezone('America/Maceio',CURRENT_TIMESTAMP))`;
    await tx`INSERT INTO public.ordem_coleta (id,solicitacao_obito_id,quantidade_corpos,status) VALUES (7220301,7220301,1,'PENDENTE_ALOCACAO')`;
  });
  criado = true;
  for (const [nome, [id, perfil]] of Object.entries(atores)) tokens[nome] = await criarJwt({ id: String(id), perfil });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {
  if (server.listening) await new Promise<void>(r => server.close(() => r()));
  try {
    if (criado) await admin.begin(async tx => {
      const usuarios = Object.values(atores).map(([id]) => id);
      // Trilhas são protegidas para o runtime; só o papel administrativo do harness limpa a fixture.
      for (const tabela of ['escala_motorista', 'indisponibilidade_motorista', 'motorista_transicao_profissional']) {
        await tx`DELETE FROM ${tx('public.' + tabela)} WHERE motorista_id IN (7220101,7220102)`;
      }
      await tx`DELETE FROM public.log_atividade WHERE usuario_id = ANY(${usuarios}::bigint[])`;
      await tx`DELETE FROM public.notificacao WHERE usuario_id = ANY(${usuarios}::bigint[])`;
      await tx`DELETE FROM public.viagem WHERE solicitacao_id IN (SELECT id FROM public.solicitacao_viagem WHERE solicitante_id=7220005)`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE solicitante_id=7220005`;
      await tx`DELETE FROM public.ordem_coleta WHERE id=7220301`;
      await tx`DELETE FROM public.solicitacao_obito WHERE id=7220301`;
      await tx`DELETE FROM public.veiculo WHERE id IN (7220201,7220202)`;
      await tx`DELETE FROM public.motorista WHERE id IN (7220101,7220102)`;
      await tx`DELETE FROM public.usuario WHERE id = ANY(${usuarios}::bigint[])`;
    });
  } finally { await sql.end(); await admin.end(); await fecharBanco(); }
});

function call(path: string, method = 'GET', body?: unknown, ator: string | null = 'gestor') {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    ...(ator ? { Authorization: 'Bearer ' + tokens[ator] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const rota = (recurso: string, motorista = M) => `/api/motoristas/${motorista}/${recurso}`;
async function limparTrilhas() {
  for (const tabela of ['escala_motorista', 'indisponibilidade_motorista', 'motorista_transicao_profissional']) {
    await admin`DELETE FROM ${admin('public.' + tabela)} WHERE motorista_id IN (7220101,7220102)`;
  }
  await admin`DELETE FROM public.log_atividade WHERE usuario_id = ANY(${Object.values(atores).map(([id]) => id)}::bigint[])
    AND descricao LIKE '%motorista ID 72201%'`;
}
async function pedidoAprovado(saida: string) {
  const criado = await call('/api/solicitacoes-viagem', 'POST', { origem: 'Fixture S10', destino: 'Unidade',
    finalidade: 'Teste isolado S10', dataHoraSaida: saida, qtdPassageiros: 1 }, 'solicitante');
  expect(criado.status).toBe(201);
  const { data } = await criado.json() as { data: { id: string } };
  expect((await call(`/api/solicitacoes-viagem/${data.id}/aprovar`, 'POST')).status).toBe(200);
  return data.id;
}

test('401 sem sessão e 403 para perfis fora de ADM/Gestor, inclusive leitura', async () => {
  for (const recurso of ['escalas', 'impedimentos', 'transicoes']) expect((await call(rota(recurso), 'GET', undefined, null)).status).toBe(401);
  for (const ator of ['svo', 'condutor', 'solicitante']) {
    expect((await call(rota('transicoes'), 'GET', undefined, ator)).status).toBe(403);
    expect((await call(rota('escalas'), 'GET', undefined, ator)).status).toBe(403);
    expect((await call(rota('inativacao'), 'POST', { motivo: 'Tentativa sem perfil' }, ator)).status).toBe(403);
  }
  expect(await sql`SELECT id FROM public.motorista_transicao_profissional WHERE motorista_id=${M}`).toEqual([]);
  expect((await call(rota('inativacao'), 'GET')).status).toBe(405);
});

test('400 recusa entrada inválida, campos extras, autoria injetada e consulta ambígua', async () => {
  const invalidos: [string, unknown][] = [
    ['inativacao', {}], ['inativacao', { motivo: '   ' }], ['inativacao', { motivo: 'x'.repeat(1001) }],
    ['inativacao', { motivo: 'ok', autorId: '7220001' }], ['inativacao', { motivo: 'a\u0000b' }],
    ['escalas', { inicio: '2099-10-01T08:00:00-03:00', fim: '2099-10-01T08:00:00-03:00', situacao: 'EM_ESCALA' }],
    ['escalas', { inicio: '2099-10-01T08:00:00', fim: '2099-10-01T18:00:00', situacao: 'EM_ESCALA' }],
    ['escalas', { inicio: '2099-10-01T08:00:00-03:00', fim: '2099-10-01T18:00:00-03:00', situacao: 'PLANTAO' }],
    ['impedimentos', { tipo: 'FERIAS', inicio: '2099-10-01T00:00:00-03:00' }],
    ['impedimentos', { tipo: 'AFASTADO', inicio: '2099-10-01T00:00:00-03:00', cid: 'X00' }],
  ];
  for (const [recurso, body] of invalidos) expect((await call(rota(recurso), 'POST', body)).status).toBe(400);
  for (const query of ['?inicio=2099-10-01T00:00:00-03:00', '?page=0', '?limit=101', '?page=1&page=2', '?extra=1']) {
    expect((await call(rota('escalas') + query)).status).toBe(400);
  }
  const conta = await fetch(base + rota('inativacao'), { method: 'POST', headers: { Authorization: 'Bearer ' + tokens.gestor, 'Content-Type': 'text/plain' }, body: 'x' });
  expect(conta.status).toBe(415);
});

test('404 para motorista inexistente e registro de outro motorista', async () => {
  expect((await call(rota('transicoes', '7220999'))).status).toBe(404);
  expect((await call(rota('inativacao', '7220999'), 'POST', { motivo: 'Inexistente' })).status).toBe(404);
  const criado = await call(rota('escalas'), 'POST', { inicio: '2099-09-01T08:00:00-03:00', fim: '2099-09-01T18:00:00-03:00', situacao: 'EM_ESCALA' });
  const { data } = schemas.RespostaEscalaMotorista.parse(await criado.json());
  expect((await call(`${rota('escalas', MSVO)}/${data.id}/cancelamento`, 'POST', { motivo: 'Outro motorista' })).status).toBe(404);
  await limparTrilhas();
});

test('escala registra autor/instante do servidor, impede sobreposição, cancela com motivo e audita sem texto', async () => {
  const body = { inicio: '2099-09-01T08:00:00-03:00', fim: '2099-09-01T18:00:00-03:00', situacao: 'EM_ESCALA' };
  const criado = await call(rota('escalas'), 'POST', body);
  expect(criado.status).toBe(201);
  const { data } = schemas.RespostaEscalaMotorista.parse(await criado.json());
  expect(data).toMatchObject({ motoristaId: M, situacao: 'EM_ESCALA', estado: 'VIGENTE', autorId: '7220002', cancelamento: null,
    inicio: '2099-09-01T11:00:00.000Z', fim: '2099-09-01T21:00:00.000Z' });
  const sobreposta = await call(rota('escalas'), 'POST', { ...body, inicio: '2099-09-01T17:00:00-03:00', fim: '2099-09-01T20:00:00-03:00' });
  expect(sobreposta.status).toBe(409);
  expect((await sobreposta.json()).error.code).toBe('ESCALA_SOBREPOSTA');
  // Fim exclusivo: período seguinte pode começar no mesmo instante.
  expect((await call(rota('escalas'), 'POST', { ...body, inicio: '2099-09-01T18:00:00-03:00', fim: '2099-09-01T22:00:00-03:00', situacao: 'FORA_DE_ESCALA' })).status).toBe(201);
  const filtro = '?' + new URLSearchParams({ inicio: '2099-09-01T07:00:00-03:00', fim: '2099-09-01T09:00:00-03:00' });
  const lista = schemas.ListaEscalasMotorista.parse(await (await call(rota('escalas') + filtro)).json());
  expect(lista.data.map(e => e.id)).toEqual([data.id]);
  expect(lista.meta).toEqual({ page: 1, limit: 20, total: 1 });
  const motivo = 'Lançamento sintético duplicado';
  const cancelado = await call(`${rota('escalas')}/${data.id}/cancelamento`, 'POST', { motivo });
  expect(cancelado.status).toBe(200);
  expect(schemas.RespostaEscalaMotorista.parse(await cancelado.json()).data).toMatchObject({ estado: 'CANCELADA',
    cancelamento: { autorId: '7220002', motivo }, inicio: data.inicio, fim: data.fim });
  const repetido = await call(`${rota('escalas')}/${data.id}/cancelamento`, 'POST', { motivo });
  expect([repetido.status, (await repetido.json()).error.code]).toEqual([409, 'REGISTRO_JA_CANCELADO']);
  const trilha = await sql`SELECT descricao FROM public.log_atividade WHERE usuario_id=7220002 AND descricao LIKE '%escala%' ORDER BY id`;
  expect(trilha.map(t => t.descricao)).toEqual([
    `Registrou escala ID ${data.id} do motorista ID ${M}`, expect.stringMatching(/^Registrou escala ID \d+ do motorista ID 7220101$/),
    `Cancelou escala ID ${data.id} do motorista ID ${M}`]);
  expect(trilha.some(t => String(t.descricao).includes(motivo))).toBe(false);
  await limparTrilhas();
});

test('inativação exige motivo, audita, não altera conta/status e alterna com reativação', async () => {
  const antes = await sql`SELECT m.status, u.ativo, u.perfil FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=${M}`;
  const inativado = await call(rota('inativacao'), 'POST', { motivo: 'Desligamento administrativo sintético' });
  expect(inativado.status).toBe(201);
  expect(schemas.RespostaTransicaoMotorista.parse(await inativado.json()).data).toMatchObject({ versao: 1, acao: 'INATIVACAO', autorId: '7220002' });
  const repetido = await call(rota('inativacao'), 'POST', { motivo: 'De novo' });
  expect([repetido.status, (await repetido.json()).error.code]).toEqual([409, 'MOTORISTA_JA_INATIVO']);
  const lista = schemas.ListaTransicoesMotorista.parse(await (await call(rota('transicoes'), 'GET', undefined, 'adm')).json());
  expect(lista.situacao).toEqual({ motoristaId: M, inativo: true });
  expect(await sql`SELECT m.status, u.ativo, u.perfil FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=${M}`).toEqual(antes);
  expect((await call(rota('reativacao'), 'POST', { motivo: 'Retorno sintético' }, 'adm')).status).toBe(201);
  const reativar = await call(rota('reativacao'), 'POST', { motivo: 'Retorno repetido' });
  expect([reativar.status, (await reativar.json()).error.code]).toEqual([409, 'MOTORISTA_NAO_INATIVO']);
  expect((await sql`SELECT descricao FROM public.log_atividade WHERE descricao LIKE '%profissionalmente o motorista ID 7220101' ORDER BY id`)
    .map(r => r.descricao)).toEqual(['Inativou profissionalmente o motorista ID 7220101', 'Reativou profissionalmente o motorista ID 7220101']);
  await limparTrilhas();
});

test('alocação bloqueia só impedimento conhecido; ausência de escala não bloqueia; reserva existente é preservada', async () => {
  const retorno = { motoristaId: M, veiculoId: V, dataHoraRetornoPrevisto: '2099-08-10T17:00:00-03:00' };
  const periodo = '?' + new URLSearchParams({ inicio: '2099-08-10T08:00:00-03:00', fim: '2099-08-10T17:00:00-03:00' });
  const livres = async () => respostaDisponibilidade.parse(await (await call('/api/solicitacoes-viagem/disponibilidade' + periodo)).json()).data.motoristas.map(m => m.id);
  const pedido = await pedidoAprovado('2099-08-10T08:00:00-03:00');
  for (const impedimento of [
    () => call(rota('impedimentos'), 'POST', { tipo: 'AFASTADO', inicio: '2099-08-10T12:00:00-03:00' }),
    () => call(rota('escalas'), 'POST', { inicio: '2099-08-10T06:00:00-03:00', fim: '2099-08-10T09:00:00-03:00', situacao: 'FORA_DE_ESCALA' }),
    () => call(rota('inativacao'), 'POST', { motivo: 'Bloqueio sintético' }),
  ]) {
    expect((await impedimento()).status).toBe(201);
    expect(await livres()).not.toContain(M);
    const recusado = await call(`/api/solicitacoes-viagem/${pedido}/agendar`, 'POST', retorno);
    expect([recusado.status, (await recusado.json()).error.code]).toEqual([409, 'MOTORISTA_IMPEDIDO']);
    await limparTrilhas();
  }
  // Sem escala registrada (dado ausente): continua elegível, como antes da SCRUM-220.
  expect(await livres()).toContain(M);
  expect((await call(`/api/solicitacoes-viagem/${pedido}/agendar`, 'POST', retorno)).status).toBe(200);
  expect((await call(rota('inativacao'), 'POST', { motivo: 'Inativação após reserva' })).status).toBe(201);
  expect(await sql`SELECT status, motorista_id::text FROM public.solicitacao_viagem WHERE id=${pedido}`).toEqual([{ status: 'AGENDADA', motorista_id: M }]);
  await limparTrilhas();
});

test('despacho SVO recusa motorista inativado com o erro SVO existente e lista só elegíveis', async () => {
  expect((await call(rota('inativacao', MSVO), 'POST', { motivo: 'Bloqueio SVO sintético' })).status).toBe(201);
  const recursos = await (await call('/api/svo/recursos-disponiveis', 'GET', undefined, 'svo')).json() as { motoristas: { id: string }[] };
  expect(recursos.motoristas.map(m => m.id)).not.toContain(MSVO);
  const recusado = await call(`/api/svo/ordens-coleta/${ORDEM}/despachar`, 'PATCH', { motoristaId: Number(MSVO), veiculoId: Number(VSVO) }, 'svo');
  expect(recusado.status).toBe(409);
  expect(await sql`SELECT status, motorista_id FROM public.ordem_coleta WHERE id=${ORDEM}`).toEqual([{ status: 'PENDENTE_ALOCACAO', motorista_id: null }]);
  await limparTrilhas();
  expect((await call(`/api/svo/ordens-coleta/${ORDEM}/despachar`, 'PATCH', { motoristaId: Number(MSVO), veiculoId: Number(VSVO) }, 'svo')).status).toBe(200);
});

test('concorrência: inativações e escalas simultâneas geram um registro e um conflito', async () => {
  const inativacoes = await Promise.all([1, 2].map(i => call(rota('inativacao'), 'POST', { motivo: `Concorrente ${i}` })));
  expect(inativacoes.map(r => r.status).sort()).toEqual([201, 409]);
  expect(await sql`SELECT versao FROM public.motorista_transicao_profissional WHERE motorista_id=${M}`).toEqual([{ versao: 1 }]);
  const escala = { inicio: '2099-07-01T08:00:00-03:00', fim: '2099-07-01T18:00:00-03:00', situacao: 'EM_ESCALA' };
  const escalas = await Promise.all([1, 2].map(() => call(rota('escalas'), 'POST', escala)));
  expect(escalas.map(r => r.status).sort()).toEqual([201, 409]);
  await limparTrilhas();
});

test('dashboard separa escala integral, dado de escala ausente e impedimento sem quebrar campos anteriores', async () => {
  const janela = '?periodo=personalizado&inicio=2099-06-01T00:00:00-03:00&fim=2099-06-02T00:00:00-03:00';
  const painel = async () => {
    const r = await call('/api/dashboard' + janela);
    expect(r.status).toBe(200);
    const { data } = dashboardConsolidadoSchemas.DashboardConsolidado.parse(await r.json());
    if (data.visao !== 'GESTAO') throw new Error('Visão incorreta');
    return data.disponibilidadeMotoristas;
  };
  const antes = await painel();
  expect(antes).toMatchObject({ estado: 'PROVISORIA', motivo: 'SEM_ESCALA_E_MATRIZ_CNH' });
  expect(antes.cobertura.comEscalaIntegral + antes.cobertura.semEscalaIntegral).toBe(antes.candidatos);
  expect((await call(rota('escalas'), 'POST', { inicio: '2099-05-31T00:00:00-03:00', fim: '2099-06-03T00:00:00-03:00', situacao: 'EM_ESCALA' })).status).toBe(201);
  const comEscala = await painel();
  expect(comEscala.candidatos).toBe(antes.candidatos);
  expect(comEscala.cobertura).toMatchObject({ comEscalaIntegral: antes.cobertura.comEscalaIntegral + 1, semEscalaIntegral: antes.cobertura.semEscalaIntegral - 1 });
  expect((await call(rota('impedimentos'), 'POST', { tipo: 'FOLGA', inicio: '2099-06-01T10:00:00-03:00', fim: '2099-06-01T12:00:00-03:00' })).status).toBe(201);
  if (antes.candidatos === 1) expect(comEscala.motivo).toBe('SEM_MATRIZ_CNH');
  const impedido = await painel();
  expect(impedido).toMatchObject({ candidatos: antes.candidatos - 1, cobertura: { impedidos: antes.cobertura.impedidos + 1,
    comEscalaIntegral: antes.cobertura.comEscalaIntegral } });
  await limparTrilhas();
});

test('DELETE preserva motorista com trilha de disponibilidade', async () => {
  expect((await call(rota('inativacao', MSVO), 'POST', { motivo: 'Trilha preservada' })).status).toBe(201);
  const r = await call(`/api/motoristas/${MSVO}`, 'DELETE');
  expect([r.status, (await r.json()).error.code]).toEqual([409, 'HISTORICO_DISPONIBILIDADE_EXISTENTE']);
  expect(await sql`SELECT id::text FROM public.motorista WHERE id=${MSVO}`).toEqual([{ id: MSVO }]);
  await limparTrilhas();
});
