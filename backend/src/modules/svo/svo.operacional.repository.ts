import { sql } from '../../database/connection.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';

/** Ocupação reservada desde o despacho até a conclusão/cancelamento.
 * As linhas de veículo são bloqueadas antes de somar as ordens, serializando concorrentes.
 * Quantidades legadas NULL não são interpretadas como um corpo: bloqueiam novas atribuições.
 */
const s10 = (v: Record<string, unknown>) => v.is_svo === true &&
  String(v.vinculo) === 'PROPRIO' && String(v.marca).toUpperCase() === 'CHEVROLET' &&
  /^S10\b/i.test(String(v.modelo)) && Number(v.capacidade_obitos) >= 4;

function num(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Quantidade fora da faixa segura.');
  return n;
}
const civil = (valor: unknown) => valor == null ? null : String(valor);

/** Apenas dados operacionais; consulta informativa revalidada na transação de despacho. */
export async function recursosDisponiveisSvo() {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const motoristas = await tx`
      SELECT m.id::text AS id, m.nome FROM public.motorista m
      JOIN public.usuario u ON u.id=m.usuario_id
      WHERE m.status='DISPONIVEL' AND u.ativo=TRUE AND u.perfil='MOTORISTA'
        AND m.validade_cnh >= timezone('America/Maceio',CURRENT_TIMESTAMP)::date
        AND NOT EXISTS (SELECT 1 FROM public.ordem_coleta oc
          WHERE oc.motorista_id=m.id AND oc.status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE'))
        AND NOT EXISTS (SELECT 1 FROM public.solicitacao_viagem sv
          WHERE sv.motorista_id=m.id AND sv.status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO'))
      ORDER BY m.id
    `;
    const veiculos = await tx`
      SELECT v.id::text AS id, v.placa, v.modelo,
        COALESCE(SUM(oc.quantidade_corpos),0)::int AS ocupacao,
        COUNT(*) FILTER (WHERE oc.id IS NOT NULL AND oc.quantidade_corpos IS NULL)::int AS sem_quantidade,
        EXISTS (SELECT 1 FROM public.solicitacao_viagem sv WHERE sv.veiculo_id=v.id
          AND sv.status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO')) AS reserva_institucional,
        EXISTS (SELECT 1 FROM public.documento_veiculo d WHERE d.veiculo_id=v.id
          AND (d.status_regular IS DISTINCT FROM TRUE
            OR d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date)) AS documento_irregular
      FROM public.veiculo v LEFT JOIN public.ordem_coleta oc ON oc.veiculo_id=v.id
        AND oc.status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')
      WHERE v.is_svo=TRUE AND v.vinculo='PROPRIO' AND UPPER(v.marca)='CHEVROLET'
        AND v.modelo ILIKE 'S10%' AND v.status='DISPONIVEL' AND v.capacidade_obitos>=4
      GROUP BY v.id, v.placa, v.modelo ORDER BY v.id
    `;
    return {
      motoristas: motoristas.map(m => ({ id:String(m.id), nome:String(m.nome) })),
      veiculos: veiculos.map(v => ({ id:String(v.id), placa:String(v.placa), modelo:String(v.modelo),
        ocupacao:num(v.ocupacao), capacidade:4 as const,
        disponivel:num(v.sem_quantidade)===0 && num(v.ocupacao)<4 &&
          !v.reserva_institucional && !v.documento_irregular })),
    };
  });
}

export async function ocupacaoSvo(id: string) {
  const [v] = await sql`
    SELECT v.id::text AS id, v.placa, COALESCE(SUM(oc.quantidade_corpos),0)::int AS ocupacao,
      COUNT(*) FILTER (WHERE oc.id IS NOT NULL AND oc.quantidade_corpos IS NULL)::int AS sem_quantidade,
      EXISTS (SELECT 1 FROM public.solicitacao_viagem sv WHERE sv.veiculo_id=v.id
        AND sv.status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO')) AS reserva_institucional,
      EXISTS (SELECT 1 FROM public.documento_veiculo d WHERE d.veiculo_id=v.id
        AND (d.status_regular IS DISTINCT FROM TRUE
          OR d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date)) AS documento_irregular
    FROM public.veiculo v LEFT JOIN public.ordem_coleta oc ON oc.veiculo_id=v.id
      AND oc.status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')
    WHERE v.id=${id}::bigint AND v.is_svo=TRUE AND v.vinculo='PROPRIO'
      AND UPPER(v.marca)='CHEVROLET' AND v.modelo ILIKE 'S10%'
      AND v.capacidade_obitos>=4 AND v.status='DISPONIVEL'
    GROUP BY v.id, v.placa
  `;
  if (!v) return null;
  return { id:String(v.id), placa:String(v.placa), ocupacao:num(v.ocupacao), capacidade:4 as const,
    disponivel:num(v.sem_quantidade)===0 && num(v.ocupacao)<4 &&
      !v.reserva_institucional && !v.documento_irregular };
}

export type ResultadoDespachoS7 =
  | { tipo:'despachada'; ordem:{ id:number; motorista_id:number; veiculo_id:number; status:'EM_DESLOCAMENTO' } }
  | { tipo:'ordem_indisponivel'|'referencia_inexistente'|'recurso_inelegivel'|'conflito_alocacao' };

/** Revalidação e alocação atômica. Mantém ID/DTO da rota de despacho legada. */
export async function prepararDespacho(dados: {ordemId:number;motoristaId:number;veiculoId:number}, atendenteId: string): Promise<ResultadoDespachoS7> {
  return sql.begin('isolation level read committed', async tx => {
    const [ordem] = await tx`
      SELECT oc.id, oc.quantidade_corpos, so.status_triagem::text AS status_triagem
      FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      WHERE oc.id=${dados.ordemId} AND oc.status='PENDENTE_ALOCACAO' FOR UPDATE OF oc
    `;
    if (!ordem || ordem.status_triagem!=='CONFIRMADA_SVO') return {tipo:'ordem_indisponivel' as const};
    const qtd = Number(ordem.quantidade_corpos);
    if (!Number.isSafeInteger(qtd) || qtd<1 || qtd>4) return {tipo:'recurso_inelegivel' as const};

    // Locks na mesma ordem que os demais fluxos de alocação: motorista, depois veículo.
    const [m] = await tx`
      SELECT m.id, m.status,
        m.validade_cnh >= timezone('America/Maceio',CURRENT_TIMESTAMP)::date AS cnh_valida,
        u.ativo AS usuario_ativo, u.perfil::text AS perfil
      FROM public.motorista m LEFT JOIN public.usuario u ON u.id=m.usuario_id
      WHERE m.id=${dados.motoristaId} FOR UPDATE OF m
    `;
    const [v] = await tx`
      SELECT id, status, is_svo, vinculo, marca, modelo, capacidade_obitos
      FROM public.veiculo WHERE id=${dados.veiculoId} FOR UPDATE
    `;
    if (!m || !v) return {tipo:'referencia_inexistente' as const};
    if (m.status!=='DISPONIVEL' || m.cnh_valida!==true || m.usuario_ativo!==true || m.perfil!=='MOTORISTA' ||
        !s10(v) || v.status!=='DISPONIVEL') return {tipo:'recurso_inelegivel' as const};
    const [documentos] = await tx`
      SELECT COUNT(*)::int AS total FROM public.documento_veiculo d WHERE d.veiculo_id=${dados.veiculoId}
        AND (d.status_regular IS DISTINCT FROM TRUE
          OR d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date)
    `;
    if (Number(documentos.total)>0) return {tipo:'recurso_inelegivel' as const};
    const [conflito] = await tx`
      SELECT EXISTS (SELECT 1 FROM public.solicitacao_viagem sv
        WHERE sv.status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO')
          AND (sv.motorista_id=${dados.motoristaId} OR sv.veiculo_id=${dados.veiculoId}))
        OR EXISTS (SELECT 1 FROM public.ordem_coleta oc
          WHERE oc.motorista_id=${dados.motoristaId}
            AND oc.status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')) AS ocupado
    `;
    if (conflito.ocupado) return {tipo:'conflito_alocacao' as const};
    const [uso] = await tx`
      SELECT COALESCE(SUM(quantidade_corpos),0)::int AS ocupacao,
             COUNT(*) FILTER (WHERE quantidade_corpos IS NULL)::int AS sem_quantidade
      FROM public.ordem_coleta
      WHERE veiculo_id=${dados.veiculoId} AND status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')
    `;
    if (Number(uso.sem_quantidade)>0 || num(uso.ocupacao)+qtd>4) return {tipo:'conflito_alocacao' as const};
    const [r] = await tx`
      UPDATE public.ordem_coleta SET motorista_id=${dados.motoristaId},veiculo_id=${dados.veiculoId},
        status='EM_DESLOCAMENTO' WHERE id=${dados.ordemId} AND status='PENDENTE_ALOCACAO'
      RETURNING id, motorista_id, veiculo_id, status
    `;
    if (!r) return {tipo:'ordem_indisponivel' as const};
    await registrarAtividades(tx,atendenteId,[{operacao:'ordem_despachada',recursoId:String(dados.ordemId)}]);
    return {tipo:'despachada' as const,ordem:{id:Number(r.id),motorista_id:Number(r.motorista_id),
      veiculo_id:Number(r.veiculo_id),status:'EM_DESLOCAMENTO' as const}};
  });
}

function dto(r: Record<string,unknown>) {
  return {id:String(r.id),codigo:String(r.codigo),solicitacaoCodigo:String(r.solicitacao_codigo),
    status:String(r.status),quantidadeCorpos:r.quantidade_corpos==null?null:num(r.quantidade_corpos),
    veiculoId:r.veiculo_id==null?null:String(r.veiculo_id),
    kmInicial:r.km_inicial==null?null:num(r.km_inicial),kmFinal:r.km_final==null?null:num(r.km_final),
    enderecoRemocao:String(r.endereco_remocao),dataInicio:civil(r.data_inicio),dataFim:civil(r.data_fim)};
}

/** Mapeamento servidor usuário->motorista. Sem dados de terceiros ou PII na resposta. */
export async function minhasOrdens(usuarioId:string) {
  const linhas = await sql`
    SELECT oc.id::text AS id, '#OC-' || oc.id::text AS codigo,
      so.codigo AS solicitacao_codigo, oc.status::text AS status, oc.quantidade_corpos,
      oc.veiculo_id::text AS veiculo_id, oc.km_inicial, oc.km_final,
      so.endereco_remocao,
      to_char(oc.data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
      to_char(oc.data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim
    FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      JOIN public.motorista m ON m.id=oc.motorista_id
    WHERE m.usuario_id=${usuarioId}::bigint
    ORDER BY oc.id DESC LIMIT 100
  `;
  return {data:linhas.map(dto)};
}
export async function minhaOrdem(usuarioId:string,id:string) {
  const [r] = await sql`
    SELECT oc.id::text AS id, '#OC-' || oc.id::text AS codigo,
      so.codigo AS solicitacao_codigo, oc.status::text AS status, oc.quantidade_corpos,
      oc.veiculo_id::text AS veiculo_id, oc.km_inicial, oc.km_final,
      so.endereco_remocao,
      to_char(oc.data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
      to_char(oc.data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim
    FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      JOIN public.motorista m ON m.id=oc.motorista_id
    WHERE oc.id=${id}::bigint AND m.usuario_id=${usuarioId}::bigint
  `;
  return r?dto(r):null;
}

export type AcaoOrdem = 'iniciar'|'etapa'|'concluir';
export type ResultadoAcao = {tipo:'nao_encontrada'|'conflito'} |
  {tipo:'ok';dados:{id:string;status:'EM_DESLOCAMENTO'|'EM_TRANSPORTE'|'CONCLUIDA'|'CANCELADA';
    dataInicio:string|null;dataFim:string|null;kmInicial:number|null;kmFinal:number|null}};

/** Fluxo permitido pelos estados reais do schema, com lock e idempotência segura (retry =>409). */
export async function executarOrdem(usuarioId:string,id:string,acao:AcaoOrdem,km:number|null):Promise<ResultadoAcao> {
  return sql.begin('isolation level read committed',async tx=>{
    const [r] = await tx`
      SELECT oc.id,oc.status::text AS status,oc.km_inicial,oc.km_final,oc.data_inicio,oc.data_fim
      FROM public.ordem_coleta oc JOIN public.motorista m ON m.id=oc.motorista_id
      WHERE oc.id=${id}::bigint AND m.usuario_id=${usuarioId}::bigint FOR UPDATE OF oc
    `;
    if(!r)return {tipo:'nao_encontrada' as const};
    const permitido=acao==='iniciar' ? r.status==='EM_DESLOCAMENTO'&&r.data_inicio==null
      :acao==='etapa' ? r.status==='EM_DESLOCAMENTO'&&r.data_inicio!=null
      :r.status==='EM_TRANSPORTE'&&r.data_inicio!=null&&r.km_inicial!=null&&km!=null&&km>=Number(r.km_inicial);
    if(!permitido)return {tipo:'conflito' as const};
    const [atualizada]=acao==='iniciar'
      ?await tx`UPDATE public.ordem_coleta SET km_inicial=${km},data_inicio=CURRENT_TIMESTAMP
        WHERE id=${id}::bigint RETURNING id::text AS id,status::text AS status,km_inicial,km_final,
          to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
          to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim`
      :acao==='etapa'
      ?await tx`UPDATE public.ordem_coleta SET status='EM_TRANSPORTE'
        WHERE id=${id}::bigint RETURNING id::text AS id,status::text AS status,km_inicial,km_final,
          to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
          to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim`
      :await tx`UPDATE public.ordem_coleta SET status='CONCLUIDA',km_final=${km},data_fim=CURRENT_TIMESTAMP
        WHERE id=${id}::bigint RETURNING id::text AS id,status::text AS status,km_inicial,km_final,
          to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
          to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim`;
    const op=acao==='iniciar'?'ordem_iniciada':acao==='etapa'?'ordem_transporte':'ordem_concluida';
    await registrarAtividades(tx,usuarioId,[{operacao:op,recursoId:id}]);
    return {tipo:'ok' as const,dados:{id:String(atualizada.id),status:atualizada.status,
      dataInicio:civil(atualizada.data_inicio),dataFim:civil(atualizada.data_fim),
      kmInicial:atualizada.km_inicial==null?null:num(atualizada.km_inicial),
      kmFinal:atualizada.km_final==null?null:num(atualizada.km_final)}};
  });
}

/** Cancelamento autorizado ao atendente: libera a ocupação agregada no commit. */
export async function cancelarOrdem(atendenteId:string,id:string):Promise<ResultadoAcao>{
  return sql.begin('isolation level read committed',async tx=>{
    const [r]=await tx`SELECT id,status::text AS status FROM public.ordem_coleta
      WHERE id=${id}::bigint FOR UPDATE`;
    if(!r)return {tipo:'nao_encontrada' as const};
    if(!['PENDENTE_ALOCACAO','EM_DESLOCAMENTO','EM_TRANSPORTE'].includes(r.status))return {tipo:'conflito' as const};
    const [atualizada]=await tx`UPDATE public.ordem_coleta SET status='CANCELADA',data_fim=CURRENT_TIMESTAMP
      WHERE id=${id}::bigint RETURNING id::text AS id,status::text AS status,km_inicial,km_final,
        to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
        to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim`;
    await registrarAtividades(tx,atendenteId,[{operacao:'ordem_cancelada',recursoId:id}]);
    return {tipo:'ok' as const,dados:{id:String(atualizada.id),status:'CANCELADA',dataInicio:civil(atualizada.data_inicio),
      dataFim:civil(atualizada.data_fim),kmInicial:atualizada.km_inicial==null?null:num(atualizada.km_inicial),
      kmFinal:atualizada.km_final==null?null:num(atualizada.km_final)}};
  });
}
