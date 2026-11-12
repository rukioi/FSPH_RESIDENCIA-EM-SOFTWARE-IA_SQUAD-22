import type postgres from 'postgres';
import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import type { criarAbastecimentoSchema } from './abastecimentos.schemas.js';
import type { validarComprovanteLegado } from './abastecimentos.comprovante.js';

export interface ConsultaAbastecimentos {
  veiculoId?: string; inicio?: string; fim?: string;
  page: number; limit: number; paginada: boolean; historico: boolean;
}
export interface LinhaAbastecimento {
  id:string;veiculo_id:string;motorista_id:string|null;litragem:string;valor_total:string;
  quilometragem:number|null;data_abastecimento:Date;criado_em:Date|null;posto:string|null;
  tanque_completo:boolean;comprovante_nome:string|null;veiculo_placa:string|null;
  motorista_nome:string|null;criado_por_id:string|null;
}
const selecao=(tx:postgres.TransactionSql)=>tx`SELECT a.id,a.veiculo_id,a.motorista_id,a.litragem,a.valor_total,
  a.quilometragem,a.data_abastecimento,a.criado_em,a.posto,a.tanque_completo,a.criado_por_id,
  coalesce(compartilhado.nome,c.nome) AS comprovante_nome,v.placa AS veiculo_placa,m.nome AS motorista_nome
  FROM public.abastecimento a
  LEFT JOIN public.abastecimento_comprovante c ON c.abastecimento_id=a.id
  LEFT JOIN LATERAL (SELECT nome FROM public.anexo WHERE abastecimento_id=a.id
    ORDER BY criado_em DESC,id DESC LIMIT 1) compartilhado ON true
  JOIN public.veiculo v ON v.id=a.veiculo_id
  LEFT JOIN public.motorista m ON m.id=a.motorista_id`;
const filtro=(tx:postgres.TransactionSql,q:ConsultaAbastecimentos)=>tx`
  WHERE (${q.veiculoId??null}::bigint IS NULL OR a.veiculo_id=${q.veiculoId??null}::bigint)
    AND (${q.inicio??null}::date IS NULL OR a.data_abastecimento>=${q.inicio??null}::date)
    AND (${q.fim??null}::date IS NULL OR a.data_abastecimento<=${q.fim??null}::date)`;

/** Lista e total compartilham snapshot; valores do cliente são parâmetros, não SQL. */
export async function consultarAbastecimentos(q:ConsultaAbastecimentos) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    if(q.veiculoId) {
      const [v]=await tx`SELECT id FROM public.veiculo WHERE id=${q.veiculoId}`;
      if(!v) throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','Veículo não encontrado.');
    }
    const ordem=q.historico ? tx`ORDER BY a.data_abastecimento ASC,a.id ASC`
      : q.paginada ? tx`ORDER BY a.data_abastecimento DESC,a.id DESC` : tx`ORDER BY a.id DESC`;
    const limite=q.paginada ? tx`LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}` : tx``;
    const rows=await tx<LinhaAbastecimento[]>`${selecao(tx)} ${filtro(tx,q)} ${ordem} ${limite}`;
    const [count]=q.paginada ? await tx`SELECT count(*)::int AS total FROM public.abastecimento a ${filtro(tx,q)}` : [{total:rows.length}];
    return {rows,total:Number(count.total)};
  });
}

/** Recupera somente os campos publicados, sem CPF, conteúdo de arquivo ou identidade privada. */
export async function consultarAbastecimento(id:string) {
  return sql.begin('read only',async tx=>{
    const [row]=await tx<LinhaAbastecimento[]>`${selecao(tx)} WHERE a.id=${id}`;
    return row;
  });
}

/** Cadastro, comprovante legado e auditoria confirmam ou revertem juntos. */
export async function inserirAbastecimento(dados:z.infer<typeof criarAbastecimentoSchema>,autorId:string,
  arquivo:ReturnType<typeof validarComprovanteLegado>) {
  return sql.begin(async tx=>{
    const [novo]=await tx`INSERT INTO public.abastecimento
      (veiculo_id,motorista_id,posto,litragem,valor_total,quilometragem,data_abastecimento,tanque_completo,criado_por_id)
      VALUES (${dados.veiculo_id},${dados.motorista_id??null},${dados.posto||null},${dados.litragem},${dados.valor_total},
        ${dados.quilometragem??null},${dados.data_abastecimento},${dados.tanque_completo??false},${autorId}) RETURNING id`;
    if(arquivo) await tx`INSERT INTO public.abastecimento_comprovante (abastecimento_id,nome,tipo,dados)
      VALUES (${novo.id},${arquivo.nome},${arquivo.tipo},${arquivo.dados})`;
    await registrarAtividades(tx,autorId,[{operacao:'abastecimento_criado',recursoId:novo.id}]);
    const [row]=await tx<LinhaAbastecimento[]>`${selecao(tx)} WHERE a.id=${novo.id}`;
    return row;
  });
}

/** Consulta os bytes apenas no download legado autorizado pela rota. */
export async function consultarComprovante(id:string) {
  const [row]=await sql<{tipo:string;dados:Buffer}[]>`SELECT tipo,dados FROM public.abastecimento_comprovante WHERE abastecimento_id=${id}`;
  return row;
}

/** Agrega no PostgreSQL em NUMERIC; não associa litros a intervalos de km sem regra aprovada. */
export async function consultarIndicadoresAbastecimentos(q:ConsultaAbastecimentos) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    if(q.veiculoId&&!(await tx`SELECT id FROM public.veiculo WHERE id=${q.veiculoId}`).length) {
      throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','Veículo não encontrado.');
    }
    const [totais]=await tx`SELECT count(*)::int AS quantidade,
      COALESCE(sum(a.litragem),0.00)::text AS "totalLitros",COALESCE(sum(a.valor_total),0.00)::text AS "totalCusto",
      round(sum(a.valor_total)/NULLIF(sum(a.litragem),0),4)::text AS "custoPorLitro",
      to_char(min(a.data_abastecimento),'YYYY-MM-DD') AS inicio,to_char(max(a.data_abastecimento),'YYYY-MM-DD') AS fim
      FROM public.abastecimento a ${filtro(tx,q)}`;
    const leituras=await tx`SELECT a.veiculo_id::text AS "veiculoId",count(a.quilometragem)::int AS "leiturasComKm",
      count(*)::int-count(a.quilometragem)::int AS "leiturasSemKm",
      min(a.quilometragem) AS "menorKm",max(a.quilometragem) AS "maiorKm"
      FROM public.abastecimento a ${filtro(tx,q)} GROUP BY a.veiculo_id ORDER BY a.veiculo_id`;
    return {totais,leituras};
  });
}
