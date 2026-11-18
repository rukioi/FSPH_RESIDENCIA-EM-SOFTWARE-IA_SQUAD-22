import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import { autorizarRegistro, registros } from '../anexos/registros.acesso.js';
import { lerConsultaRegistro } from '../anexos/anexos.service.js';
import { anotacoesSchemas, consultaNotas, criarNota } from './anotacoes.schemas.js';
type Vinculo = Pick<z.infer<typeof criarNota>,'tipoRegistro'|'registroId'>;
type Linha = {id:string;texto:string;autor_id:string;criado_em:Date};
const dto=(row:Linha,vinculo:Vinculo)=>({id:row.id,texto:row.texto,autorId:row.autor_id,
  criadoEm:row.criado_em.toISOString(),tipoRegistro:vinculo.tipoRegistro,registroId:vinculo.registroId});
const invalido=()=>new ErroHttp(400,'DADOS_INVALIDOS','Informe vínculo e texto de 1 a 2.000 caracteres.');

/** Nota e auditoria são atômicas; autor/instante vêm da sessão/banco, sem alterar o registro. */
export async function criarAnotacao(usuario:UsuarioAutenticado,body:unknown){
  const result=criarNota.safeParse(body);if(!result.success)throw invalido();
  const entrada=result.data;
  return sql.begin(async tx=>{
    await autorizarRegistro(tx,usuario,entrada);
    const [row]=await tx<Linha[]>`INSERT INTO public.anotacao
      ${tx({[registros[entrada.tipoRegistro].coluna]:entrada.registroId,texto:entrada.texto,autor_id:usuario.id})}
      RETURNING id,texto,autor_id,criado_em`;
    await registrarAtividades(tx,usuario.id,[{operacao:'anotacao_criada',recursoId:row.id}]);
    return anotacoesSchemas.RespostaAnotacao.parse({data:dto(row,entrada)});
  });
}

/** Lê apenas notas do registro autorizado, com total e página no mesmo snapshot. */
export async function listarAnotacoes(usuario:UsuarioAutenticado,params:URLSearchParams){
  const result=consultaNotas.safeParse(lerConsultaRegistro(params));if(!result.success)throw invalido();
  const q=result.data;
  return sql.begin('isolation level repeatable read',async tx=>{
    await autorizarRegistro(tx,usuario,q);
    const coluna=tx(registros[q.tipoRegistro].coluna);
    const rows=await tx<Linha[]>`SELECT id,texto,autor_id,criado_em FROM public.anotacao
      WHERE ${coluna}=${q.registroId} ORDER BY criado_em DESC,id DESC LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`;
    const [total]=await tx`SELECT count(*)::int AS n FROM public.anotacao WHERE ${coluna}=${q.registroId}`;
    return anotacoesSchemas.ListaAnotacoes.parse({data:rows.map(row=>dto(row,q)),meta:{page:q.page,limit:q.limit,total:total.n}});
  });
}
