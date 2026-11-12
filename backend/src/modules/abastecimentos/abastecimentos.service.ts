import { ErroHttp } from '../../shared/http/errors.js';
import { abastecimentosSchemas, criarAbastecimentoSchema, dataCivilAbastecimento, identificadorAbastecimento } from './abastecimentos.schemas.js';
import { consultarAbastecimento, consultarAbastecimentos, consultarIndicadoresAbastecimentos, inserirAbastecimento, type ConsultaAbastecimentos, type LinhaAbastecimento } from './abastecimentos.repository.js';
import { validarComprovanteLegado } from './abastecimentos.comprovante.js';

const invalido=()=>new ErroHttp(400,'DADOS_INVALIDOS','Confira os campos, datas, valores e limites do abastecimento.');
const dto=(r:LinhaAbastecimento)=>abastecimentosSchemas.DetalheAbastecimento.parse({...r,
  data_abastecimento:r.data_abastecimento.toISOString(),criado_em:r.criado_em?.toISOString()??null});

/** Valida BIGINT sem coerção imprecisa e mantém IDs negativos reservados às fixtures oficiais. */
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
  return (q.historico?abastecimentosSchemas.HistoricoAbastecimentos:abastecimentosSchemas.ListaAbastecimentosRF40).parse(response);
}

/** Retorna apenas métricas inequívocas; a ausência de fórmula de consumo é explícita. */
export async function obterIndicadoresAbastecimentos(params:URLSearchParams) {
  for(const key of params.keys()) if(!['veiculoId','inicio','fim'].includes(key))throw invalido();
  const q=lerConsultaAbastecimentos(params);
  const {totais,leituras}=await consultarIndicadoresAbastecimentos(q);
  return abastecimentosSchemas.IndicadoresAbastecimentos.parse({data:{
    estado:totais.quantidade===0?'SEM_ABASTECIMENTOS':'DISPONIVEL',quantidade:totais.quantidade,
    totalLitros:totais.totalLitros,totalCusto:totais.totalCusto,custoPorLitro:totais.custoPorLitro,
    periodoObservado:{inicio:totais.inicio,fim:totais.fim},kmObservadosPorVeiculo:leituras,
    consumoPorDistancia:{valor:null,estado:'INDISPONIVEL',motivo:'REGRA_DE_NEGOCIO_PENDENTE'},
  }});
}

/** Detalhe real, com autoria histórica desconhecida explícita como NULL. */
export async function detalharAbastecimento(id:string) {
  const row=await consultarAbastecimento(lerIdentificadorAbastecimento(id));
  if(!row) throw new ErroHttp(404,'NAO_ENCONTRADO','Abastecimento não encontrado.');
  return {data:dto(row)};
}

/** Valida RF40 e delega escrita atômica com autor obtido exclusivamente da sessão. */
export async function cadastrarAbastecimento(body:unknown,autorId:string) {
  // Assinatura/nome/limite legado mantêm ARQUIVO_INVALIDO, sem criar uma segunda infraestrutura.
  const arquivo=validarComprovanteLegado(typeof body==='object'&&body!==null&&'comprovante' in body ? body.comprovante : undefined);
  const entrada=criarAbastecimentoSchema.safeParse(body);
  if(!entrada.success) throw invalido();
  try { return {data:dto(await inserirAbastecimento(entrada.data,autorId,arquivo))}; }
  catch(error) {
    const code=typeof error==='object'&&error!==null&&'code' in error ? error.code : undefined;
    if(code==='23503') throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','Veículo, motorista ou autor não encontrado.');
    if(['23502','23514','22P02','22001','22003','22007','22008'].includes(String(code))) throw invalido();
    // Não deduplicar por data/valor: o contrato não define uma chave de abastecimento repetido.
    if(code==='40001'||code==='40P01') throw new ErroHttp(409,'CONFLITO','O cadastro não foi confirmado por um conflito. Consulte os registros antes de tentar novamente.');
    throw error;
  }
}
