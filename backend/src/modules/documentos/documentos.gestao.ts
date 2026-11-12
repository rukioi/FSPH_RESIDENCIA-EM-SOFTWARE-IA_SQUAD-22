import type postgres from 'postgres';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registroId } from '../anexos/anexos.schemas.js';
import { alterarDocumento,consultaDocumental,gestaoDocumentalSchemas,tipoDocumental } from './documentos.gestao.schemas.js';
import { alvoDocumental,registrarVersaoDocumental,type TipoDocumental } from './documentos.historico.js';
const invalido=()=>new ErroHttp(400,'DADOS_INVALIDOS','Confira tipo, filtros, versão e data civil do documento.');
const ausente=()=>new ErroHttp(404,'NAO_ENCONTRADO','Documento não encontrado.');
const conflito=()=>new ErroHttp(409,'CONFLITO','O documento foi alterado. Consulte a versão atual antes de salvar.');

/** Query estrita sem inferir janela de alerta RF46. */
export function lerQueryDocumental(params:URLSearchParams){
  for(const key of params.keys())if(params.getAll(key).length!==1)throw invalido();
  for(const key of ['page','limit'])if(params.has(key)&&!(/^[1-9]\d*$/).test(params.get(key)!))throw invalido();
  const q=consultaDocumental.safeParse(Object.fromEntries(params));if(!q.success)throw invalido();return q.data;
}
function identidade(id:string,params:URLSearchParams,historico=false){
  if(!registroId.safeParse(id).success)throw ausente();
  for(const key of params.keys())if(!['tipo',...(historico?['page','limit']:[])].includes(key))throw invalido();
  const q=lerQueryDocumental(params);return {...q,tipo:tipoDocumental.parse(q.tipo??'DOCUMENTO_VEICULO')};
}
const fonte=(tx:postgres.TransactionSql)=>tx`WITH documentos AS (
  SELECT d.id,'DOCUMENTO_VEICULO'::text AS tipo,d.veiculo_id AS registro_id,d.data_vencimento AS validade,
    d.tipo_documento,NULL::text AS numero_cnh,NULL::text AS categoria_cnh,d.status_regular AS regular,
    coalesce((SELECT max(h.versao) FROM public.documento_historico h WHERE h.documento_veiculo_id=d.id),0)::int AS versao
  FROM public.documento_veiculo d UNION ALL
  SELECT m.id,'CNH_MOTORISTA',m.id,m.validade_cnh,NULL,m.cnh,m.categoria_cnh,NULL::boolean,
    coalesce((SELECT max(h.versao) FROM public.documento_historico h WHERE h.motorista_id=m.id),0)::int
  FROM public.motorista m)`;
const projecao=(tx:postgres.TransactionSql)=>tx`id::text,tipo,registro_id::text AS "registroId",to_char(validade,'YYYY-MM-DD') AS "dataValidade",
  tipo_documento AS "tipoDocumento",numero_cnh AS "numeroCnh",categoria_cnh AS "categoriaCnh",regular,
  (validade-CURRENT_DATE)::int AS "diasRestantes",versao`;
const atual=async(tx:postgres.TransactionSql,id:string,tipo:TipoDocumental)=>{
  const [row]=await tx`${fonte(tx)} SELECT ${projecao(tx)} FROM documentos WHERE id=${id} AND tipo=${tipo}`;
  if(!row)throw ausente();return row;
};

/** Consulta paginada real nas tabelas existentes; datas e situação são avaliadas pelo PostgreSQL. */
export async function consultarDocumentos(params:URLSearchParams){
  const q=lerQueryDocumental(params);
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const filtro=tx`WHERE (${q.tipo??null}::text IS NULL OR tipo=${q.tipo??null})
      AND (${q.veiculoId??null}::bigint IS NULL OR tipo='DOCUMENTO_VEICULO' AND registro_id=${q.veiculoId??null})
      AND (${q.motoristaId??null}::bigint IS NULL OR tipo='CNH_MOTORISTA' AND registro_id=${q.motoristaId??null})
      AND (${q.inicio??null}::date IS NULL OR validade>=${q.inicio??null}::date)
      AND (${q.fim??null}::date IS NULL OR validade<=${q.fim??null}::date)
      AND (${q.situacao??null}::text IS NULL OR ${q.situacao??null}='VENCIDO' AND validade<CURRENT_DATE
        OR ${q.situacao??null}='HOJE' AND validade=CURRENT_DATE OR ${q.situacao??null}='A_VENCER' AND validade>CURRENT_DATE)`;
    const rows=await tx`${fonte(tx)} SELECT ${projecao(tx)} FROM documentos ${filtro}
      ORDER BY validade,tipo,id LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`;
    const [total]=await tx`${fonte(tx)} SELECT count(*)::int AS n FROM documentos ${filtro}`;
    return gestaoDocumentalSchemas.ListaDocumental.parse({data:rows,meta:{page:q.page,limit:q.limit,total:total.n}});
  });
}
/** ID acompanhado de tipo distingue CNH de documento veicular, sem reconstruir histórico. */
export async function detalharDocumento(id:string,params:URLSearchParams,historico=false){
  const q=identidade(id,params,historico);
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const row=await atual(tx,id,q.tipo);
    if(!historico)return gestaoDocumentalSchemas.DetalheDocumental.parse({data:row});
    const coluna=tx(alvoDocumental(q.tipo).coluna);
    const rows=await tx`SELECT id::text,versao,to_char(data_vencimento,'YYYY-MM-DD') AS "dataValidade",
      tipo_documento AS "tipoDocumento",numero_cnh AS "numeroCnh",categoria_cnh AS "categoriaCnh",
      status_regular AS regular,anexo_id::text AS "anexoId",autor_id::text AS "autorId",criado_em
      FROM public.documento_historico WHERE ${coluna}=${id} ORDER BY versao DESC,id DESC
      LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`;
    const [total]=await tx`SELECT count(*)::int AS n FROM public.documento_historico WHERE ${coluna}=${id}`;
    return gestaoDocumentalSchemas.HistoricoDocumental.parse({data:rows.map(r=>({...r,criadoEm:(r.criado_em as Date).toISOString()})),
      meta:{page:q.page,limit:q.limit,total:total.n}});
  });
}
/** Concorrência por versão sob lock: atualização, snapshot e auditoria confirmam juntos. */
export async function editarDocumento(id:string,params:URLSearchParams,body:unknown,autorId:string){
  const {tipo}=identidade(id,params);const parsed=alterarDocumento.safeParse(body);if(!parsed.success)throw invalido();
  const p=parsed.data;const {tabela,coluna}=alvoDocumental(tipo);
  if(tipo==='CNH_MOTORISTA'?p.tipoDocumento!==undefined:p.numeroCnh!==undefined||p.categoriaCnh!==undefined)throw invalido();
  try{return await sql.begin(async tx=>{
    if(!(await tx`SELECT id FROM ${tx('public.'+tabela)} WHERE id=${id} FOR UPDATE`).length)throw ausente();
    const row=await atual(tx,id,tipo);if(row.versao!==p.versao)throw conflito();
    if(p.anexoId&&!(await tx`SELECT id FROM public.anexo WHERE id=${p.anexoId} AND ${tx(coluna)}=${id}`).length)throw ausente();
    if(tipo==='CNH_MOTORISTA'){
      if(p.numeroCnh&&(await tx`SELECT id FROM public.motorista WHERE cnh=${p.numeroCnh} AND id<>${id}`).length)throw new ErroHttp(409,'CNH_DUPLICADA','CNH já cadastrada.');
      await tx`UPDATE public.motorista SET validade_cnh=${p.dataValidade},cnh=coalesce(${p.numeroCnh??null},cnh),
        categoria_cnh=coalesce(${p.categoriaCnh??null},categoria_cnh) WHERE id=${id}`;
    }else await tx`UPDATE public.documento_veiculo SET data_vencimento=${p.dataValidade},
      tipo_documento=coalesce(${p.tipoDocumento??null},tipo_documento) WHERE id=${id}`;
    await registrarVersaoDocumental(tx,tipo,id,autorId,p.anexoId??null);
    return gestaoDocumentalSchemas.DetalheDocumental.parse({data:await atual(tx,id,tipo)});
  });}catch(error){
    if(error&&typeof error==='object'&&'code'in error&&['40001','40P01','23505'].includes(String(error.code)))throw conflito();
    throw error;
  }
}
