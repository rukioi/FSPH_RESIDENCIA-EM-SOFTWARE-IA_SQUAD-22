import type postgres from 'postgres';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';

export interface ConsultaAbastecimentos {
  veiculoId?: string; inicio?: string; fim?: string;
  page: number; limit: number; paginada: boolean; historico: boolean;
}
export interface LinhaAbastecimento {
  id:string;veiculo_id:string;motorista_id:string|null;litragem:string;valor_total:string;
  quilometragem:number|null;data_abastecimento:Date;criado_em:Date|null;posto:string|null;
  tanque_completo:boolean;comprovante_nome:string|null;veiculo_placa:string|null;
  motorista_nome:string|null;
}
const selecao=(tx:postgres.TransactionSql)=>tx`SELECT a.id,a.veiculo_id,a.motorista_id,a.litragem,a.valor_total,
  a.quilometragem,a.data_abastecimento,a.criado_em,a.posto,a.tanque_completo,
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

/** Sob o lock do veículo, compara com a última leitura válida até a data informada.
 * Reutiliza a ordem data/cadastro/ID dos indicadores; não infere km nem altera o odômetro.
 */
export async function validarLeituraAnterior(tx: postgres.TransactionSql, veiculoId: number | string,
  dia: string, quilometragem: number) {
  const [anterior] = await tx<{ quilometragem: number }[]>`
    SELECT quilometragem FROM public.abastecimento
    WHERE veiculo_id=${veiculoId} AND data_abastecimento<=${dia}::date AND quilometragem>=0
    ORDER BY data_abastecimento DESC,criado_em DESC NULLS FIRST,id DESC LIMIT 1`;
  if (anterior && quilometragem < anterior.quilometragem) {
    throw new ErroHttp(409, 'ODOMETRO_INCONSISTENTE', 'Quilometragem inferior à leitura anterior do abastecimento.');
  }
}
