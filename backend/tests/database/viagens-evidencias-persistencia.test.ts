import {afterAll,beforeAll,expect,test} from 'vitest';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {inserirVersaoEvidencia} from '../../src/modules/viagens/viagens.evidencias.repository.js';
const sql=await verifiedSql(),admin=await verifiedSql(true);
let created=false;
const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
const entrada={momento:'INICIAL',nome:'odometro.png',tipo:'image/png',dadosBase64:png.toString('base64')};
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (8890201,'S8-E6-901',-27003,'A','B','Teste','2099-01-01 08:00','AGENDADA',-27001,-27001)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8890301,8890201,-27001,-27001,'AGENDADA')`;
  });created=true;
});
afterAll(async()=>{
  try{if(created){await admin`DELETE FROM public.viagem_evidencia WHERE viagem_id=8890301`;await sql.begin(async tx=>{
    await tx`DELETE FROM public.viagem WHERE id=8890301`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8890201`;
  });}}finally{await sql.end();await admin.end();}
});
test('grava bytes originais e versões concorrentes sem sobrescrever a anterior',async()=>{
  const resultados=await Promise.all([
    sql.begin(tx=>inserirVersaoEvidencia(tx,'8890301','-27004',entrada)),
    sql.begin(tx=>inserirVersaoEvidencia(tx,'8890301','-27004',entrada)),
  ]);
  expect(resultados.map(r=>r.versao).sort()).toEqual([1,2]);
  const rows=await sql`SELECT momento,versao,nome,tipo,dados,enviado_por_id::text FROM public.viagem_evidencia WHERE viagem_id=8890301 ORDER BY versao`;
  expect(rows).toHaveLength(2);
  for(const row of rows){expect(row).toMatchObject({momento:'INICIAL',nome:'odometro.png',tipo:'image/png',enviado_por_id:'-27004'});expect(row.dados).toEqual(png);}
  const final=await sql.begin(tx=>inserirVersaoEvidencia(tx,'8890301','-27004',{...entrada,momento:'FINAL'}));expect(final.versao).toBe(1);
});
test('falha posterior reverte a inserção da evidência',async()=>{
  await expect(sql.begin(async tx=>{await inserirVersaoEvidencia(tx,'8890301','-27004',entrada);throw new Error('rollback de teste');})).rejects.toThrow('rollback de teste');
  const rows=await sql`SELECT versao FROM public.viagem_evidencia WHERE viagem_id=8890301 AND momento='INICIAL' ORDER BY versao`;
  expect(rows.map(row=>row.versao)).toEqual([1,2]);
});
test('recusa imagem inválida e viagem inexistente',async()=>{
  await expect(sql.begin(tx=>inserirVersaoEvidencia(tx,'8890301','-27004',{...entrada,dadosBase64:'AAAA'}))).rejects.toMatchObject({status:400});
  await expect(sql.begin(tx=>inserirVersaoEvidencia(tx,'999999999','-27004',entrada))).rejects.toMatchObject({status:404});
});
