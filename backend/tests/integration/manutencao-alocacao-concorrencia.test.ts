import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { despacharOrdem } from '../../src/modules/svo/svo.repository.js';
import { pngViagem } from '../viagens-imagens.js';

const app = createApp();
let db: Awaited<ReturnType<typeof verifiedSql>>;
let observador: Awaited<ReturnType<typeof verifiedSql>>;
let criouFixtures = false;
let base: string;
let gestor: string;
let atendente: string;
let motoristaToken: string;
const motorista = 89233001;
const usuario = 89233002;
const operador = 89233003;
const veiculo = 89233004;
const alternativo = 89233005;
const pedido = 89233006;
const ordem = 89233007;
const obito = 89233008;
const dia = '2099-01-03';
let hoje: string;
let amanha: string;

beforeAll(async () => {
  db = await verifiedSql(true);
  observador = await verifiedSql(true);
  await db.begin(async tx => {
    const [datas] = await tx`SELECT (statement_timestamp() AT TIME ZONE 'America/Maceio')::date::text AS hoje,
      ((statement_timestamp() AT TIME ZONE 'America/Maceio')::date+1)::text AS amanha`;
    ({hoje, amanha} = datas as {hoje:string; amanha:string});
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES
      (${usuario},'Motorista SCRUM-233','s233-driver@example.invalid','fixture','MOTORISTA',true),
      (${operador},'Atendente SCRUM-233','s233-svo@example.invalid','fixture','ATENDENTE_SVO',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status)
      VALUES (${motorista},${usuario},'Motorista SCRUM-233','S233-DRIVER','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo,vinculo,capacidade_obitos,quilometragem_atual) VALUES
      (${veiculo},'S23A301','CHEVROLET','  Chevrolet s10 (Unidade 1)  ',2026,'PASSEIO','DISPONIVEL',true,'PROPRIO',4,0),
      (${alternativo},'S23A302','CHEVROLET','S10 Alternativo',2026,'PASSEIO','DISPONIVEL',true,'PROPRIO',4,0)`;
  });
  criouFixtures = true;
  gestor = await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});
  atendente = await criarJwt({id:String(operador),perfil:'ATENDENTE_SVO'});
  motoristaToken = await criarJwt({id:String(usuario),perfil:'MOTORISTA'});
  await new Promise<void>(resolve => app.listen(0,'127.0.0.1',resolve));
  base = 'http://127.0.0.1:' + (app.address() as AddressInfo).port;
});

async function limpar() {
  await db.begin(async tx => {
    await tx`DELETE FROM public.log_atividade
      WHERE usuario_id IN (${usuario},${operador}) OR solicitacao_viagem_id=${pedido}
        OR (tipo_evento LIKE 'manutencao_%' AND EXISTS (SELECT 1 FROM public.manutencao_veiculo m
          WHERE m.veiculo_id IN (${veiculo},${alternativo}) AND strpos(descricao, 'Manutenção ID ' || m.id || ' — ')=1))`;
    await tx`DELETE FROM public.manutencao_veiculo_historico WHERE manutencao_id IN
      (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id IN (${veiculo},${alternativo}))`;
    await tx`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id IN
      (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id IN (${veiculo},${alternativo}))`;
    await tx`DELETE FROM public.manutencao_veiculo WHERE veiculo_id IN (${veiculo},${alternativo})`;
    await tx`DELETE FROM public.notificacao WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id=${pedido})`;
    await tx`DELETE FROM public.viagem_evidencia WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id=${pedido})`;
    await tx`DELETE FROM public.viagem WHERE solicitacao_id=${pedido}`;
    await tx`DELETE FROM public.solicitacao_viagem WHERE id=${pedido}`;
    await tx`DELETE FROM public.ordem_coleta WHERE id=${ordem}`;
    await tx`DELETE FROM public.solicitacao_obito WHERE id=${obito}`;
  });
}

afterAll(async () => {
  if (app.listening) await new Promise<void>(resolve => app.close(() => resolve()));
  if (!db) return;
  try {
    if (!criouFixtures) return;
    await limpar();
    await db`DELETE FROM public.veiculo WHERE id IN (${veiculo},${alternativo})`;
    await db`DELETE FROM public.motorista WHERE id=${motorista}`;
    await db`DELETE FROM public.usuario WHERE id IN (${usuario},${operador})`;
  } finally { await Promise.all([db.end(), observador?.end()]); }
});

function chamar(path: string, method: string, body: unknown, token = gestor, versao?: string) {
  return fetch(base + '/api/' + path, {
    method, headers: {Authorization:'Bearer '+token,'Content-Type':'application/json', ...(versao ? {'If-Match':versao}: {})},
    body:JSON.stringify(body), signal:AbortSignal.timeout(15000),
  });
}

function cadastrar(data = dia, imediata = false, recurso = veiculo) {
  return chamar('manutencoes','POST',{ veiculoId:String(recurso), tipo:'CORRETIVA', descricao:'Corrida SCRUM-233',
    entrada:data, conclusaoPrevista:data, quilometragem:0, iniciarImediatamente:imediata });
}

type Registro = {id:string; versao:string};
async function dados(resposta: Promise<Response>, status: number): Promise<Registro> {
  const res = await resposta;
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(status);
  return body.data;
}
function transicao(m: Registro, acao: string, destino?: string) {
  return chamar('manutencoes/'+m.id+'/status','PATCH',{acao, ...(destino ? {destino}: {})},gestor,m.versao);
}

type Alocacao = 'agendar'|'reagendar'|'troca'|'iniciar'|'despachar';
async function alocacao(acao: Alocacao) {
  if (acao === 'despachar') {
    await db`INSERT INTO public.solicitacao_obito(id,codigo,atendente_id,local_falecimento,endereco_remocao,solicitante_nome,status_triagem,triado_por_id,triado_em)
      VALUES (${obito},'S233-SVO',${operador},'Fixture','Fixture','Fixture','CONFIRMADA_SVO',${operador},clock_timestamp())`;
    await db`INSERT INTO public.ordem_coleta(id,solicitacao_obito_id,status,quantidade_corpos) VALUES (${ordem},${obito},'PENDENTE_ALOCACAO',1)`;
    return () => chamar('svo/ordens-coleta/'+ordem+'/despachar','PATCH',{motoristaId:motorista,veiculoId:veiculo},atendente);
  }
  const saida = (acao === 'iniciar' ? amanha : acao === 'agendar' ? dia : '2099-01-06') + ' 08:00';
  const fim = saida.replace('08:00','12:00');
  const reservado = acao !== 'agendar';
  const recurso = acao === 'troca' ? alternativo : veiculo;
  await db`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,
    data_hora_retorno_previsto,status,motorista_id,veiculo_id) VALUES (${pedido},'S233-INST',-27003,'A','B',
    'Fixture',${saida}::timestamp,${reservado ? fim : null}::timestamp,
    ${reservado ? 'AGENDADA':'APROVADA'}::public.status_solicitacao,${reservado ? motorista : null},${reservado ? recurso : null})`;
  let viagem: string | undefined;
  if (reservado) {
    const [row] = await db`INSERT INTO public.viagem(solicitacao_id,motorista_id,veiculo_id,status)
      VALUES (${pedido},${motorista},${recurso},'AGENDADA') RETURNING id::text`;
    viagem = row.id;
  }
  if (acao === 'iniciar') return () => chamar('viagens/'+viagem+'/iniciar','PATCH',{quilometragem:0,
    foto:{nome:'inicio.png',tipo:'image/png',dadosBase64:pngViagem.toString('base64')}},motoristaToken);
  return () => chamar('solicitacoes-viagem/'+pedido+'/'+(acao === 'troca' ? 'reagendar' : acao),'POST',{
    motoristaId:String(motorista),veiculoId:String(veiculo),dataHoraRetornoPrevisto:dia+'T12:00:00-03:00',
    ...(acao !== 'agendar' ? {dataHoraSaida:dia+'T08:00:00-03:00'} : {}),
  });
}

async function esperarLock(bloqueador:number, anterior?:number) {
  const limite=Date.now()+5000;
  while(Date.now()<limite) {
    const rows=await observador`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'
      AND position('public.veiculo' in query)>0 AND position('FOR UPDATE' in query)>0 AND pid<>${anterior ?? 0}
      AND (${bloqueador}=ANY(pg_blocking_pids(pid)) OR ${anterior ?? 0}=ANY(pg_blocking_pids(pid)))`;
    if(rows.length===1) return Number(rows[0].pid);
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error('Espera pelo lock do veículo não observada');
}

async function corrida(primeira:()=>Promise<Response>, segunda:()=>Promise<Response>, esperado: [number,number]) {
  const gate = await db.reserve();
  const pendentes: Promise<Response>[] = [];
  let aberta = true;
  try {
    await gate`BEGIN`;
    const [p] = await gate`SELECT pg_backend_pid() AS pid`;
    await gate`SELECT id FROM public.veiculo WHERE id=${veiculo} FOR UPDATE`;
    pendentes.push(primeira());
    const primeiro = await esperarLock(p.pid);
    pendentes.push(segunda());
    await esperarLock(p.pid, primeiro);
    await gate`COMMIT`;
    aberta = false;
    const respostas = await Promise.all(pendentes);
    for (const [i,r] of respostas.entries()) {
      const body = await r.json();
      expect(r.status, JSON.stringify(body)).toBe(esperado[i]);
      if (r.status === 409) expect(JSON.stringify(body)).toMatch(/conflit|aloca/i);
    }
  } finally {
    if (aberta) await gate`ROLLBACK`;
    gate.release();
    await Promise.allSettled(pendentes);
  }
}

const cenarios = [
  {nome:'cadastro x agendamento', alocar:'agendar', manutencao:'cadastro'},
  {nome:'cadastro x reagendamento', alocar:'reagendar', manutencao:'cadastro'},
  {nome:'cadastro x saída antecipada', alocar:'iniciar', manutencao:'cadastro'},
  {nome:'início de manutenção x despacho', alocar:'despachar', manutencao:'inicio'},
  {nome:'cadastro x troca de veículo', alocar:'troca', manutencao:'cadastro'},
  {nome:'reativação x reserva', alocar:'agendar', manutencao:'reativacao'},
  {nome:'reabertura x reserva', alocar:'agendar', manutencao:'reabertura'},
  {nome:'alteração de janela x reserva', alocar:'agendar', manutencao:'edicao'},
  {nome:'corretiva imediata x despacho', alocar:'despachar', manutencao:'imediata'},
] as const;

for (const c of cenarios) for (const primeiro of ['manutenção','alocação'] as const) {
  test(c.nome + ' com ' + primeiro + ' adquirindo primeiro', async () => {
    await limpar();
    let manutencao = () => cadastrar(c.alocar === 'iniciar' ? hoje : dia, c.manutencao === 'imediata');
    let anterior: Registro | undefined;
    if (c.manutencao === 'inicio' || c.manutencao === 'reativacao' || c.manutencao === 'reabertura' || c.manutencao === 'edicao') {
      anterior = await dados(cadastrar(c.manutencao === 'edicao' ? '2099-01-08' : dia),201);
      if (c.manutencao === 'reativacao') anterior = await dados(transicao(anterior,'CANCELAR'),200);
      if (c.manutencao === 'reabertura') {
        anterior = await dados(transicao(anterior,'INICIAR'),200);
        anterior = await dados(transicao(anterior,'CONCLUIR'),200);
      }
      const m = anterior;
      manutencao = c.manutencao === 'edicao'
        ? () => chamar('manutencoes/'+m.id,'PATCH',{entrada:dia,conclusaoPrevista:dia},gestor,m.versao)
        : () => transicao(m, c.manutencao === 'inicio' ? 'INICIAR' : c.manutencao === 'reativacao' ? 'REATIVAR' : 'REABRIR',
          c.manutencao === 'inicio' ? undefined : 'AGENDADA');
    }
    const atribuir = await alocacao(c.alocar);
    if (primeiro === 'manutenção') {
      await corrida(manutencao, atribuir, [anterior ? 200 : 201,409]);
      if (c.alocar === 'despachar') {
        const [o] = await db`SELECT status,veiculo_id FROM public.ordem_coleta WHERE id=${ordem}`;
        expect(o).toMatchObject({status:'PENDENTE_ALOCACAO',veiculo_id:null});
      } else {
        const [p] = await db`SELECT status,veiculo_id::text FROM public.solicitacao_viagem WHERE id=${pedido}`;
        expect(p).toMatchObject({status:c.alocar === 'agendar' ? 'APROVADA' : 'AGENDADA',
          veiculo_id:c.alocar === 'agendar' ? null : String(c.alocar === 'troca' ? alternativo : veiculo)});
      }
    } else {
      await corrida(atribuir, manutencao, [200,409]);
      const registros = await db`SELECT id::text, atualizado_em FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo}`;
      expect(registros.map(r=>r.id)).toEqual(anterior ? [anterior.id] : []);
      if (anterior) {
        const resposta = await fetch(base+'/api/manutencoes/'+anterior.id,{headers:{Authorization:'Bearer '+gestor}});
        expect(resposta.headers.get('etag')).toBe(anterior.versao);
      }
    }
  }, 20000);
}

test('duas manutenções e despacho antes de janela futura são compatíveis', async () => {
  await limpar();
  await corrida(() => cadastrar(), () => cadastrar(), [201,201]);
  const despachar = await alocacao('despachar');
  await corrida(() => cadastrar(), despachar, [201,200]);
  await dados(cadastrar('2099-01-04'),201);
  const body = await fetch(base+'/api/svo/veiculos/'+veiculo+'/ocupacao',{headers:{Authorization:'Bearer '+atendente}});
  expect(body.status).toBe(200);
  expect(await body.json()).toMatchObject({ocupacao:1,capacidade:4,disponivel:true});
}, 20000);

test('lock do veículo não impede manutenção em veículo distinto', async () => {
  await limpar();
  const gate = await db.reserve();
  try {
    await gate`BEGIN`;
    await gate`SELECT id FROM public.veiculo WHERE id=${veiculo} FOR UPDATE`;
    await dados(cadastrar(dia,false,alternativo),201);
  } finally {
    await gate`ROLLBACK`;
    gate.release();
  }
});


test('status manual após a reserva bloqueia a saída e preserva o compromisso', async () => {
  await limpar();
  const iniciar = await alocacao('iniciar');
  await db`UPDATE public.veiculo SET status='EM_MANUTENCAO' WHERE id=${veiculo}`;
  try {
    await dados(iniciar(),409);
    const [row] = await db`SELECT s.status, v.status AS viagem_status, v.data_inicio
      FROM public.solicitacao_viagem s JOIN public.viagem v ON v.solicitacao_id=s.id WHERE s.id=${pedido}`;
    expect(row).toMatchObject({status:'AGENDADA',viagem_status:'AGENDADA',data_inicio:null});
  } finally {
    await db`UPDATE public.veiculo SET status='DISPONIVEL' WHERE id=${veiculo}`;
  }
});

test('viagem ativa sem retorno confiável admite cadastro futuro mas impede início da manutenção', async () => {
  await limpar();
  const iniciar = await alocacao('iniciar');
  await db`UPDATE public.solicitacao_viagem SET data_hora_retorno_previsto=NULL WHERE id=${pedido}`;
  await dados(iniciar(),200);
  const m = await dados(cadastrar(),201);
  await dados(transicao(m,'INICIAR'),409);
});

test.each([['janela atual', (): string => hoje, false], ['janela vencida', (): string => '2020-01-01', false],
  ['em andamento', (): string => dia, true]] as const)('SVO recusa despacho com %s e conserva ocupação real', async (_nome, data, imediata) => {
  await limpar();
  await dados(cadastrar(data(),imediata),201);
  const despachar = await alocacao('despachar');
  await dados(despachar(),409);
  const res = await fetch(base+'/api/svo/veiculos/'+veiculo+'/ocupacao',{headers:{Authorization:'Bearer '+atendente}});
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ocupacao:0,capacidade:4,disponivel:false});
});


test('disponibilidade institucional filtra só o veículo e agenda preserva a reserva', async () => {
  await limpar();
  const consultar = async (inicio:string, fim:string) => {
    const params = new URLSearchParams({inicio,fim});
    const res = await fetch(base+'/api/solicitacoes-viagem/disponibilidade?'+params,{headers:{Authorization:'Bearer '+gestor}});
    expect(res.status).toBe(200);
    return (await res.json()).data as {motoristas:{id:string}[];veiculos:{id:string}[]};
  };
  await dados(cadastrar(),201);
  const sobreposta = await consultar(dia+'T08:00:00-03:00',dia+'T12:00:00-03:00');
  expect(sobreposta.veiculos.map(v=>v.id)).not.toContain(String(veiculo));
  expect(sobreposta.veiculos.map(v=>v.id)).toContain(String(alternativo));
  expect(sobreposta.motoristas.map(m=>m.id)).toContain(String(motorista));
  const adjacente = await consultar('2099-01-04T00:00:00-03:00','2099-01-04T12:00:00-03:00');
  expect(adjacente.veiculos.map(v=>v.id)).toContain(String(veiculo));
  await alocacao('reagendar');
  await db`UPDATE public.veiculo SET status='EM_MANUTENCAO' WHERE id=${veiculo}`;
  try {
    const params = new URLSearchParams({inicio:'2099-01-06T00:00:00-03:00',fim:'2099-01-07T00:00:00-03:00'});
    const res = await fetch(base+'/api/solicitacoes-viagem/agenda?'+params,{headers:{Authorization:'Bearer '+gestor}});
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(expect.arrayContaining([expect.objectContaining({id:String(pedido)})]));
  } finally {
    await db`UPDATE public.veiculo SET status='DISPONIVEL' WHERE id=${veiculo}`;
  }
});

test('conclusão e cancelamento liberam apenas o próprio bloqueio e conservam status manual', async () => {
  await limpar();
  const a = await dados(cadastrar(dia,true),201);
  const b = await dados(cadastrar(dia,true),201);
  const c = await dados(cadastrar(),201);
  await dados(transicao(a,'CONCLUIR'),200);
  await dados(transicao(c,'CANCELAR'),200);
  const despachar = await alocacao('despachar');
  await dados(despachar(),409);
  await db`UPDATE public.veiculo SET status='EM_MANUTENCAO' WHERE id=${veiculo}`;
  try {
    await dados(transicao(b,'CONCLUIR'),200);
    const [v] = await db`SELECT status FROM public.veiculo WHERE id=${veiculo}`;
    expect(v.status).toBe('EM_MANUTENCAO');
  } finally {
    await db`UPDATE public.veiculo SET status='DISPONIVEL' WHERE id=${veiculo}`;
  }
  await dados(despachar(),200);
});


test('quantidade NULL pendente é inelegível e NULL ativo bloqueia sem inventar ocupação', async () => {
  await limpar();
  const despachar = await alocacao('despachar');
  await db`UPDATE public.ordem_coleta SET quantidade_corpos=NULL WHERE id=${ordem}`;
  await dados(despachar(),409);
  await db`UPDATE public.ordem_coleta SET status='EM_DESLOCAMENTO',veiculo_id=${veiculo},motorista_id=${motorista}
    WHERE id=${ordem}`;
  const res = await fetch(base+'/api/svo/recursos-disponiveis',{headers:{Authorization:'Bearer '+atendente}});
  expect(res.status).toBe(200);
  const {veiculos} = await res.json() as {veiculos:{id:string}[]};
  expect(veiculos.find(v=>v.id===String(veiculo))).toMatchObject({ocupacao:0,capacidade:4,disponivel:false});
  const [row] = await db`SELECT quantidade_corpos,status FROM public.ordem_coleta WHERE id=${ordem}`;
  expect(row).toMatchObject({quantidade_corpos:null,status:'EM_DESLOCAMENTO'});
});


test('despacho alternativo consulta a manutenção sob o lock do veículo', async () => {
  await limpar();
  await alocacao('despachar');
  const m = await dados(cadastrar(hoje),201);
  const comando = {ordemId:ordem,motoristaId:motorista,veiculoId:veiculo};
  await expect(despacharOrdem(comando)).resolves.toEqual({tipo:'conflito_alocacao'});
  await dados(transicao(m,'CANCELAR'),200);
  await expect(despacharOrdem(comando)).resolves.toMatchObject({tipo:'despachada'});
});

test('listagem, ocupação e despacho usam o mesmo reconhecimento da Chevrolet S10', async () => {
  await limpar();
  const despachar = await alocacao('despachar');
  const headers = { Authorization:'Bearer '+atendente };
  async function consultar() {
    const resposta = await fetch(base+'/api/svo/recursos-disponiveis', { headers });
    expect(resposta.status).toBe(200);
    return (await resposta.json()).veiculos as {id:string;disponivel:boolean}[];
  }
  const ocupacao = () => fetch(base+'/api/svo/veiculos/'+veiculo+'/ocupacao', { headers });
  try {
    await db`UPDATE public.veiculo SET modelo='Chevrolet S100' WHERE id=${veiculo}`;
    expect((await consultar()).some(v=>v.id===String(veiculo))).toBe(false);
    expect((await ocupacao()).status).toBe(404);
    await dados(despachar(),409);
    await db`UPDATE public.veiculo SET modelo='  Chevrolet s10 (Unidade 1)  ' WHERE id=${veiculo}`;
    expect(await consultar()).toEqual(expect.arrayContaining([expect.objectContaining({id:String(veiculo),disponivel:true})]));
    const capacidade = await ocupacao();
    expect(capacidade.status).toBe(200);
    expect(await capacidade.json()).toMatchObject({capacidade:4,disponivel:true});
    await dados(despachar(),200);
  } finally {
    await db`UPDATE public.veiculo SET modelo='  Chevrolet s10 (Unidade 1)  ' WHERE id=${veiculo}`;
  }
});
