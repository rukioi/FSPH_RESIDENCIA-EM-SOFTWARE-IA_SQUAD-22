import { test } from 'node:test';
import assert from 'node:assert/strict';
import { root,project,container,volume,database,port,workspaceHash,validarIdentidade,verifiedSql,verifyContainer } from './s9-preflight-harness.mjs';

test('recusa configuracao de banco diferente antes de inspecionar ou conectar',async()=>{
  const anterior=process.env.DATABASE_URL;
  try{
    process.env.DATABASE_URL='postgresql://alvo-nao-autorizado.invalid/banco';
    assert.throws(()=>verifyContainer(),/Alvo recusado/);
    await assert.rejects(verifiedSql(),/Alvo recusado/);
    process.env.DATABASE_URL='';
    assert.throws(()=>verifyContainer(),/Alvo recusado/);
  }finally{
    if(anterior===undefined)delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=anterior;
  }
});

test('recusa divergencias de checkout, container, porta, volume, nonce e marcador',()=>{
  const nonce='00000000-0000-4000-8000-000000000001',id='a'.repeat(64),imageId='sha256:'+('b'.repeat(64));
  const labels={'fsph.project':project,'fsph.workspace':workspaceHash,'fsph.nonce':nonce};
  const manifesto={workspace:root,project,container,volume,database,port,nonce,marker:project+':'+nonce,containerId:id,imageId};
  const info={Id:id,Name:'/'+container,Image:imageId,State:{Running:true},Config:{Labels:labels},
    Mounts:[{Type:'volume',Name:volume,Destination:'/var/lib/postgresql/data',RW:true}],
    NetworkSettings:{Ports:{'5432/tcp':[{HostPort:port,HostIp:'127.0.0.1'}]}}};
  const disco={Name:volume,Driver:'local',Scope:'local',Labels:labels};
  assert.equal(validarIdentidade(manifesto,info,disco),manifesto);
  const alteracoes=[
    (m)=>{m.workspace='outro';},(m)=>{m.containerId='c'.repeat(64);},(m)=>{m.nonce='invalido';},
    (m)=>{m.marker='outro';},(m)=>{m.port='55432';},
    (_m,i)=>{i.State.Running=false;},(_m,i)=>{i.Config.Labels['fsph.project']='outro';},
    (_m,i)=>{i.NetworkSettings.Ports['5432/tcp'][0].HostIp='0.0.0.0';},
    (_m,i)=>{i.Mounts[0].Name='outro';},(_m,_i,d)=>{d.Labels['fsph.nonce']='outro';},
    (_m,_i,d)=>{d.Driver='outro';},
  ];
  for(const alterar of alteracoes){
    const m=structuredClone(manifesto),i=structuredClone(info),d=structuredClone(disco);
    alterar(m,i,d);assert.throws(()=>validarIdentidade(m,i,d),/Identidade Docker Sprint 9 divergente/);
  }
});
