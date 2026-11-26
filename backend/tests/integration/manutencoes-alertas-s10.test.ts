import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../../src/app.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { atualizarRevisoesManutencao, processarAlertasManutencao } from '../../src/modules/manutencoes/manutencoes.alertas.js';
import { criarEscritaManutencao } from '../../src/modules/manutencoes/manutencoes.service.js';
import { iniciarLembretes } from '../../src/modules/notificacoes/lembretes.service.js';

const app = createApp();
const veiculo = '-23441001';
const inativo = '-23441002';
let db: Awaited<ReturnType<typeof verifiedSql>>;
let base: string, token: string;
let hoje: string, ontem: string, amanha: string, dia6: string, dia7: string;
let criada = false;

beforeAll(async () => {
  db = await verifiedSql(true);
  token = await criarJwt({ id:'-27001', perfil:'ADM' });
  await db.begin(async tx => {
    const [dias] = await tx`SELECT d::text AS hoje, (d-1)::text AS ontem, (d+1)::text AS amanha,
      (d+6)::text AS dia6, (d+7)::text AS dia7
      FROM (SELECT (statement_timestamp() AT TIME ZONE 'America/Maceio')::date AS d) r`;
    ({hoje,ontem,amanha,dia6,dia7} = dias as typeof dias & {hoje:string;ontem:string;amanha:string;dia6:string;dia7:string});
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
      VALUES (${veiculo},'S34A011','Fixture','Manutenção',2026,'PASSEIO','DISPONIVEL')`;
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo)
      VALUES (${inativo},'Fixture inativa','fixture-s234-inativa@example.invalid','fixture','ADM',false)`;
  });
  criada = true;
  await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+(app.address() as AddressInfo).port;
});

async function limpar() {
  await db.begin(async tx => {
    await tx`DELETE FROM public.notificacao WHERE chave LIKE 'manutencao:-23442%:%'`;
    await tx`DELETE FROM public.log_atividade WHERE descricao LIKE 'Manutenção ID -23442% — %'`;
    await tx`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id IN
      (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo})`;
    await tx`DELETE FROM public.manutencao_veiculo_historico WHERE manutencao_id IN
      (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo})`;
    await tx`DELETE FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo}`;
  });
}
beforeEach(async () => { await limpar(); });
afterAll(async () => {
  if(app.listening) await new Promise<void>(resolve=>app.close(()=>resolve()));
  if(!db) return;
  try {
    if(!criada) return;
    await limpar();
    await db`DELETE FROM public.veiculo WHERE id=${veiculo}`;
    await db`DELETE FROM public.usuario WHERE id=${inativo}`;
  } finally {await db.end();}
});

async function fixture(id:number, entrada:string, previsao=entrada, tipo='PREVENTIVA') {
  await db`INSERT INTO public.manutencao_veiculo
    (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
    VALUES (${id},${veiculo},${tipo}::public.tipo_manutencao_veiculo,'Fixture S234',
      ${entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${previsao}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001)`;
}

function http(id:number, sufixo='', body?:unknown, etag?:string) {
  return fetch(base+'/api/manutencoes/'+id+sufixo, {
    method:body ? 'PATCH':'GET', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(etag ? {'If-Match':etag}:{})},
    body:body === undefined ? undefined : JSON.stringify(body),
  });
}

async function alterar(id:number, body:unknown, sufixo='') {
  const atual=await http(id);
  const resultado=await http(id,sufixo,body,atual.headers.get('etag')!);
  expect(resultado.status,await resultado.text()).toBe(200);
}

function avisos(id:number, alerta='PREVENTIVA_PROXIMA') {
  return db`SELECT usuario_id::text,chave,titulo,descricao,criado_em::text,lida_em::text FROM public.notificacao
    WHERE chave LIKE ${'manutencao:'+id+':'+alerta+':%'} ORDER BY chave,public.notificacao.usuario_id`;
}
function revisoes(id:number) {
  return db`SELECT alerta,revisao::text FROM public.manutencao_alerta_revisao WHERE manutencao_id=${id} ORDER BY alerta`;
}
const id=-23442001;

test('janela de sete dias, ativação, perfis ativos e reexecução preservam a primeira leitura', async () => {
  await fixture(id,hoje);
  await fixture(id-1,dia6);
  await fixture(id-2,dia7);
  await fixture(id-3,hoje,hoje,'CORRETIVA');
  const indicadores = await fetch(base+'/api/manutencoes/indicadores?veiculoId='+veiculo,{headers:{Authorization:'Bearer '+token}});
  expect(indicadores.status).toBe(200);
  expect(await revisoes(id)).toEqual([]);
  expect(await avisos(id)).toEqual([]);
  await processarAlertasManutencao();
  const [esperados] = await db`SELECT array_agg(id::text ORDER BY id) AS ids FROM public.usuario WHERE ativo AND perfil IN ('ADM','GESTOR_FROTA')`;
  expect((await avisos(id)).map(n=>n.usuario_id)).toEqual(esperados.ids);
  expect(esperados.ids).toEqual(expect.arrayContaining(['-27001','-27002']));
  expect((await avisos(id-1)).length).toBeGreaterThan(0);
  expect(await avisos(id-2)).toEqual([]);
  expect(await avisos(id-3)).toEqual([]);
  const [n] = await db`SELECT id::text FROM public.notificacao WHERE usuario_id=-27001 AND chave=${'manutencao:'+id+':PREVENTIVA_PROXIMA:1'}`;
  const ler=()=>fetch(base+'/api/notificacoes/'+n.id+'/ler',{method:'POST',headers:{Authorization:'Bearer '+token}});
  expect((await ler()).status).toBe(200);
  const lidos = await avisos(id);
  expect(lidos.find(n=>n.usuario_id==='-27001')?.lida_em).toBeTruthy();
  await processarAlertasManutencao();
  expect((await ler()).status).toBe(200);
  expect(await avisos(id)).toEqual(lidos);
});

test('continuidade, campos irrelevantes, tipo e A-B-A avançam somente ao sair da elegibilidade', async () => {
  await fixture(id,hoje);
  await processarAlertasManutencao();
  await alterar(id,{entrada:amanha,conclusaoPrevista:amanha,descricao:'Texto',custo:'123.00',prestador:'Oficina',observacoes:'Nota',quilometragem:44});
  await processarAlertasManutencao();
  expect(await revisoes(id)).toEqual([{alerta:'PREVENTIVA_PROXIMA',revisao:'1'}]);
  await alterar(id,{entrada:dia7,conclusaoPrevista:dia7});
  await alterar(id,{entrada:hoje,conclusaoPrevista:hoje});
  await processarAlertasManutencao();
  expect(await revisoes(id)).toEqual([{alerta:'PREVENTIVA_PROXIMA',revisao:'2'}]);
  expect(new Set((await avisos(id)).map(n=>n.chave)).size).toBe(2);
  await alterar(id,{tipo:'CORRETIVA'});
  await processarAlertasManutencao();
  expect(await revisoes(id)).toEqual([{alerta:'PREVENTIVA_PROXIMA',revisao:'3'}]);
  await alterar(id,{tipo:'PREVENTIVA'});
  await processarAlertasManutencao();
  expect(new Set((await avisos(id)).map(n=>n.chave)).size).toBe(3);
});

test('INICIAR encerra atraso de entrada apenas quando a previsão ainda não venceu', async () => {
  await fixture(id,ontem,amanha,'CORRETIVA');
  await fixture(id-1,ontem,ontem,'CORRETIVA');
  await processarAlertasManutencao();
  await alterar(id,{acao:'INICIAR'},'/status');
  await alterar(id-1,{acao:'INICIAR'},'/status');
  expect(await revisoes(id)).toEqual([{alerta:'ATRASO',revisao:'2'}]);
  expect(await revisoes(id-1)).toEqual([{alerta:'ATRASO',revisao:'1'}]);
  // Mantém a revisão e representa o dia em que essa previsão já venceu.
  await db`UPDATE public.manutencao_veiculo
    SET conclusao_prevista_em=${ontem}::date::timestamp AT TIME ZONE 'America/Maceio' WHERE id=${id}`;
  await processarAlertasManutencao();
  expect(new Set((await avisos(id,'ATRASO')).map(v=>v.chave)).size).toBe(2);
  expect(new Set((await avisos(id-1,'ATRASO')).map(v=>v.chave)).size).toBe(1);
});

test('cancelamento e conclusão ficam inelegíveis; reativação e reabertura incrementam as revisões uma vez', async () => {
  await fixture(id,hoje);
  await alterar(id,{acao:'CANCELAR'},'/status');
  await processarAlertasManutencao();
  expect(await avisos(id)).toEqual([]);
  await alterar(id,{acao:'REATIVAR',destino:'AGENDADA',alteracoes:{entrada:amanha,conclusaoPrevista:amanha}},'/status');
  expect(await revisoes(id)).toEqual([{alerta:'ATRASO',revisao:'2'},{alerta:'PREVENTIVA_PROXIMA',revisao:'2'}]);
  await alterar(id,{acao:'INICIAR'},'/status');
  await alterar(id,{acao:'CONCLUIR'},'/status');
  await processarAlertasManutencao();
  expect(await avisos(id)).toEqual([]);
  const antes=await revisoes(id);
  await alterar(id,{acao:'REABRIR',destino:'AGENDADA',alteracoes:{entrada:amanha,conclusaoPrevista:amanha}},'/status');
  expect((await revisoes(id)).map(r=>Number(r.revisao))).toEqual(antes.map(r=>Number(r.revisao)+1));
  await processarAlertasManutencao();
  expect(new Set((await avisos(id)).map(v=>v.chave)).size).toBe(1);
});

test('lotes progridem e processadores concorrentes deixam uma chave por destinatário', async () => {
  const ids=Array.from({length:28},(_,i)=>id-i);
  for(const ocorrencia of ids) await fixture(ocorrencia,hoje);
  await processarAlertasManutencao();
  expect((await db`SELECT DISTINCT chave FROM public.notificacao WHERE chave LIKE 'manutencao:-23442%:PREVENTIVA_PROXIMA:1'`).length).toBe(28);
  await Promise.all([processarAlertasManutencao(),processarAlertasManutencao()]);
  expect((await db`SELECT DISTINCT chave FROM public.notificacao WHERE chave LIKE 'manutencao:-23442%:PREVENTIVA_PROXIMA:1'`).length).toBe(28);
  const [duplicadas] = await db`SELECT count(*)::int AS n FROM (
    SELECT usuario_id,chave FROM public.notificacao WHERE chave LIKE 'manutencao:-23442%:%'
    GROUP BY usuario_id,chave HAVING count(*)>1) d`;
  expect(duplicadas.n).toBe(0);
});

test('edição travada é ignorada pelo consumidor; emissão anterior mantém aviso válido', async () => {
  await fixture(id,hoje);
  const atual = {tipo:'PREVENTIVA',status:'AGENDADA',entrada:hoje,conclusaoPrevista:hoje} as const;
  await db.begin(async tx => {
    await tx`SELECT id FROM public.veiculo WHERE id=${veiculo} FOR UPDATE`;
    await tx`SELECT id FROM public.manutencao_veiculo WHERE id=${id} FOR UPDATE`;
    await processarAlertasManutencao();
    expect(await tx`SELECT id FROM public.notificacao WHERE chave LIKE ${'manutencao:'+id+':%'}`).toEqual([]);
    await atualizarRevisoesManutencao(tx,String(id),atual,{...atual,entrada:dia7,conclusaoPrevista:dia7},'EDITAR');
    await tx`UPDATE public.manutencao_veiculo SET entrada_em=${dia7}::date::timestamp AT TIME ZONE 'America/Maceio',
      conclusao_prevista_em=${dia7}::date::timestamp AT TIME ZONE 'America/Maceio' WHERE id=${id}`;
  });
  await processarAlertasManutencao();
  expect(await avisos(id)).toEqual([]);
  await alterar(id,{entrada:hoje,conclusaoPrevista:hoje});
  await processarAlertasManutencao();
  const emitidos=await avisos(id);
  await alterar(id,{acao:'CANCELAR'},'/status');
  await processarAlertasManutencao();
  expect(await avisos(id)).toEqual(emitidos);
  expect(emitidos.every(n=>String(n.chave).endsWith(':2'))).toBe(true);
});

test('falhas de auditoria e inserção da caixa revertem a revisão e permitem recuperação', async () => {
  await fixture(id,hoje);
  const detalhe=await http(id);
  const escrita=criarEscritaManutencao(async()=>{},async()=>{throw new Error('Falha sintética de auditoria');});
  await expect(escrita.alterar(String(id),'-27001',detalhe.headers.get('etag')!,
    {edicao:{entrada:dia7,conclusaoPrevista:dia7}})).rejects.toThrow('Falha sintética de auditoria');
  expect(await revisoes(id)).toEqual([]);
  expect((await (await http(id)).json()).data.entrada).toBe(hoje);
  const chave='manutencao:'+id+':PREVENTIVA_PROXIMA:1';
  const gate=await db.reserve();
  try {
    await gate`BEGIN`;
    await gate`INSERT INTO public.notificacao(usuario_id,chave,titulo,descricao,categoria)
      VALUES (-27001,${chave},'Bloqueio sintético','Fixture','atencao')`;
    await processarAlertasManutencao();
  } finally { await gate`ROLLBACK`; gate.release(); }
  expect(await revisoes(id)).toEqual([]);
  expect(await avisos(id)).toEqual([]);
  await processarAlertasManutencao();
  expect((await avisos(id)).length).toBeGreaterThan(0);
}, 10000);

test('ciclo automático usa o emissor sem disparo por HTTP',async()=>{
  await fixture(id,hoje);
  const original=process.env.MANUTENCAO_ALERTAS_ATIVOS;
  process.env.MANUTENCAO_ALERTAS_ATIVOS='true';
  const parar=iniciarLembretes();
  try { await expect.poll(async()=>(await avisos(id)).length).toBeGreaterThan(0); }
  finally {
    await parar();
    if(original===undefined) delete process.env.MANUTENCAO_ALERTAS_ATIVOS;
    else process.env.MANUTENCAO_ALERTAS_ATIVOS=original;
  }
});


test('emissor com lock adquirido precede edição concorrente e o aviso conserva a revisão original', async()=>{
  await fixture(id,hoje);
  const etag=(await http(id)).headers.get('etag')!;
  const gate=await db.reserve();
  const observador=await verifiedSql(true);
  let pendente:ReturnType<typeof processarAlertasManutencao>|undefined;
  let edicao:Promise<Response>|undefined;
  async function aguardarBloqueio(pid:number, trecho:string) {
    const ate=Date.now()+1400;
    while(Date.now()<ate){
      const [r]=await observador`SELECT pid FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'
          AND ${pid}=ANY(pg_blocking_pids(pid)) AND position(${trecho} in query)>0`;
      if(r) return Number(r.pid);
      await new Promise(resolve=>setTimeout(resolve,15));
    }
    throw new Error('Lock esperado não observado em '+trecho);
  }
  try {
    await gate`BEGIN`;
    const [dono]=await gate`SELECT pg_backend_pid() AS pid`;
    await gate`SELECT id FROM public.usuario WHERE id=-27001 FOR UPDATE`;
    pendente=processarAlertasManutencao();
    const emissor=await aguardarBloqueio(Number(dono.pid),'FOR SHARE OF u');
    edicao=http(id,'',{entrada:dia7,conclusaoPrevista:dia7},etag);
    await aguardarBloqueio(emissor,'public.manutencao_veiculo');
  } finally {
    await gate`ROLLBACK`;
    gate.release();
    await Promise.allSettled([pendente, edicao]);
    await observador.end();
  }
  expect((await pendente)?.emitidas).toBeGreaterThan(0);
  expect((await edicao)?.status).toBe(200);
  expect((await avisos(id)).every(n=>String(n.chave).endsWith(':1'))).toBe(true);
  expect(await revisoes(id)).toEqual([{alerta:'PREVENTIVA_PROXIMA',revisao:'2'}]);
});

test('falha real no incremento e falha de histórico revertem a mutação', async()=>{
  await fixture(id,hoje);
  await db`INSERT INTO public.manutencao_alerta_revisao VALUES (${id},'PREVENTIVA_PROXIMA',9223372036854775807)`;
  const atual=await http(id);
  const res=await http(id,'',{entrada:dia7,conclusaoPrevista:dia7},atual.headers.get('etag')!);
  expect(res.status).toBe(500);
  expect((await (await http(id)).json()).data.entrada).toBe(hoje);
  expect(await revisoes(id)).toEqual([{alerta:'PREVENTIVA_PROXIMA',revisao:'9223372036854775807'}]);
  await alterar(id,{acao:'CANCELAR'},'/status');
  await db`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id=${id}`;
  const cancelada=await http(id);
  const escrita=criarEscritaManutencao(async()=>{},undefined,async()=>{throw new Error('Falha sintética de histórico');});
  await expect(escrita.alterar(String(id),'-27001',cancelada.headers.get('etag')!,
    {transicao:{acao:'REATIVAR',destino:'AGENDADA'}})).rejects.toThrow('Falha sintética de histórico');
  expect(await revisoes(id)).toEqual([]);
  expect((await (await http(id)).json()).data.status).toBe('CANCELADA');
});

test('aviso existente de status manual é preservado e nenhum alerta estruturado é inventado', async()=>{
  const [n]=await db`INSERT INTO public.notificacao(usuario_id,chave,titulo,descricao,categoria,lida_em)
    VALUES (-27001,'s234-fixture-aviso-manual','Veículo S34A011 em manutenção','Fixture','atencao',statement_timestamp())
    RETURNING id::text,lida_em::text`;
  try {
    await db`UPDATE public.veiculo SET status='EM_MANUTENCAO' WHERE id=${veiculo}`;
    await processarAlertasManutencao();
    expect(await db`SELECT id::text,lida_em::text FROM public.notificacao WHERE id=${n.id}`).toEqual([n]);
    expect(await db`SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo}`).toEqual([]);
  } finally {
    await db`UPDATE public.veiculo SET status='DISPONIVEL' WHERE id=${veiculo}`;
    await db`DELETE FROM public.notificacao WHERE id=${n.id}`;
  }
});


test('emissao desativada preserva a escrita das revisoes e permite ativacao posterior', async()=>{
  const original=process.env.MANUTENCAO_ALERTAS_ATIVOS;
  process.env.MANUTENCAO_ALERTAS_ATIVOS='false';
  await fixture(id,hoje);
  const pararDesativado=iniciarLembretes();
  try {
    await alterar(id,{entrada:dia7,conclusaoPrevista:dia7});
    await alterar(id,{entrada:hoje,conclusaoPrevista:hoje});
    expect(await revisoes(id)).toEqual([{ alerta:'PREVENTIVA_PROXIMA', revisao:'2' }]);
    expect(await avisos(id)).toEqual([]);
    await pararDesativado();
    expect(await avisos(id)).toEqual([]);
    process.env.MANUTENCAO_ALERTAS_ATIVOS='true';
    const pararAtivado=iniciarLembretes();
    try {
      await expect.poll(async()=>(await avisos(id)).length).toBeGreaterThan(0);
      const [esperados]=await db`SELECT array_agg(id::text ORDER BY id) AS ids FROM public.usuario
        WHERE ativo AND perfil IN ('ADM','GESTOR_FROTA')`;
      const entregues=await avisos(id);
      expect(entregues.map(a=>a.usuario_id)).toEqual(esperados.ids);
      expect(new Set(entregues.map(a=>a.chave))).toEqual(new Set(['manutencao:'+id+':PREVENTIVA_PROXIMA:2']));
    } finally { await pararAtivado(); }
  } finally {
    await pararDesativado();
    if(original===undefined) delete process.env.MANUTENCAO_ALERTAS_ATIVOS;
    else process.env.MANUTENCAO_ALERTAS_ATIVOS=original;
  }
});

test('lotes avançam mesmo com lock; excedente e ocorrência adiada saem no ciclo seguinte', async () => {
  await db`INSERT INTO public.manutencao_veiculo
    (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
    SELECT g, ${veiculo}, 'PREVENTIVA', 'Fixture lote S234',
      ${hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${hoje}::date::timestamp AT TIME ZONE 'America/Maceio', 0, 'AGENDADA', -27001, -27001
    FROM generate_series(-23442999, -23442899) g`;
  const primeiro = await db.begin(async tx => {
    await tx`SELECT id FROM public.manutencao_veiculo WHERE id = -23442999 FOR UPDATE`;
    return processarAlertasManutencao();
  });
  expect(primeiro).toMatchObject({ falhas: 0, adiadas: 1, restantes: true });
  expect(await avisos(-23442999)).toHaveLength(0);
  expect(await avisos(-23442899)).toHaveLength(0);
  expect((await avisos(-23442998)).length).toBeGreaterThan(0);
  const segundo = await processarAlertasManutencao();
  expect(segundo).toMatchObject({ falhas: 0, adiadas: 0, restantes: false });
  expect((await avisos(-23442999)).length).toBeGreaterThan(0);
  expect((await avisos(-23442899)).length).toBeGreaterThan(0);
  expect(await processarAlertasManutencao()).toEqual({ emitidas: 0, falhas: 0, adiadas: 0, restantes: false });
}, 30000);
