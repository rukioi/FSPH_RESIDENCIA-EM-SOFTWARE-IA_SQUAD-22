import { ErroHttp } from '../../shared/http/errors.js';
import { abastecimentosSchemas, dataCivilAbastecimento, identificadorAbastecimento } from './abastecimentos.schemas.js';
import { consultarAbastecimento, consultarAbastecimentos, type ConsultaAbastecimentos, type LinhaAbastecimento } from './abastecimentos.repository.js';

const invalido=()=>new ErroHttp(400,'DADOS_INVALIDOS','Confira os campos, datas, valores e limites do abastecimento.');
const dto=(r:LinhaAbastecimento)=>abastecimentosSchemas.DetalheAbastecimento.parse({...r,
  data_abastecimento:r.data_abastecimento.toISOString(),criado_em:r.criado_em?.toISOString()??null});

/** Valida BIGINT positivo sem coerção imprecisa. */
export function lerIdentificadorAbastecimento(value:unknown):string {
  const result=identificadorAbastecimento.safeParse(value);
  if(!result.success) throw invalido();
  return BigInt(result.data).toString();
}

/** Preserva a coleção legada sem filtros; consultas novas são paginadas e validam datas civis. */
export function lerConsultaAbastecimentos(params:URLSearchParams,veiculoId?:string):ConsultaAbastecimentos {
  const reconhecidos=['veiculoId','inicio','fim','pagina','limit'];
  for(const k of reconhecidos) if(params.getAll(k).length>1) throw invalido();
  const inteiro=(key:string,padrao:number)=>{
    if(!params.has(key)) return padrao;
    const raw=params.get(key)!;
    if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw))) throw invalido();
    return Number(raw);
  };
  const page=inteiro('pagina',1),limit=inteiro('limit',20);
  if(limit>100||!Number.isSafeInteger((page-1)*limit)) throw invalido();
  const civil=(key:string)=>{
    if(!params.has(key)) return undefined;
    const r=dataCivilAbastecimento.safeParse(params.get(key));
    if(!r.success) throw invalido();
    return r.data;
  };
  const inicio=civil('inicio'),fim=civil('fim');
  if(inicio&&fim&&inicio>fim) throw invalido();
  const filtroId=params.has('veiculoId') ? lerIdentificadorAbastecimento(params.get('veiculoId')) : undefined;
  const pathId=veiculoId ? lerIdentificadorAbastecimento(veiculoId) : undefined;
  if(pathId&&filtroId&&pathId!==filtroId) throw invalido();
  return {veiculoId:pathId??filtroId,inicio,fim,page,limit,paginada:!!pathId||reconhecidos.some(k=>params.has(k)),historico:!!pathId};
}

/** Consulta dados persistidos; ausência de registros é distinta de recurso inexistente. */
export async function listarAbastecimentos(params:URLSearchParams,veiculoId?:string) {
  const q=lerConsultaAbastecimentos(params,veiculoId);
  const {rows,total}=await consultarAbastecimentos(q);
  const response={data:rows.map(dto),...(q.paginada?{meta:{page:q.page,limit:q.limit,total}}:{})};
  return (q.historico?abastecimentosSchemas.HistoricoAbastecimentos:abastecimentosSchemas.ListaAbastecimentos).parse(response);
}

/** Detalhe real sem atribuir autoria não registrada pelo cadastro atual. */
export async function detalharAbastecimento(id:string) {
  const row=await consultarAbastecimento(lerIdentificadorAbastecimento(id));
  if(!row) throw new ErroHttp(404,'NAO_ENCONTRADO','Abastecimento não encontrado.');
  return {data:dto(row)};
}
