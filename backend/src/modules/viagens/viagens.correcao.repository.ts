import type {z} from 'zod';
import {sql} from '../../database/connection.js';
import {ErroHttp} from '../../shared/http/errors.js';
import {registrarAtividades} from '../auditoria/auditoria.service.js';
import type {corrigirQuilometragemSchema} from './viagens.correcao.schemas.js';

type Leitura={inicio:string|null;fim:string|null;km_inicial:number|null;km_final:number|null;status:string};
function conflito(mensagem:string):never {throw new ErroHttp(409,'ODOMETRO_INCONSISTENTE',mensagem);}
/** Corrige uma viagem concluída, preservando histórico e verificando a cronologia conhecida. */
export async function corrigirQuilometragem(id:string,autorId:string,dados:z.infer<typeof corrigirQuilometragemSchema>) {
  return sql.begin('isolation level read committed',async tx=>{
    const [ref]=await tx`SELECT solicitacao_id::text,veiculo_id::text FROM public.viagem WHERE id=${id}`;
    if(!ref)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    if(!ref.solicitacao_id||!ref.veiculo_id)conflito('Viagem sem solicitação ou veículo vinculado.');
    const [pedido]=await tx`SELECT id FROM public.solicitacao_viagem WHERE id=${ref.solicitacao_id} FOR UPDATE`;
    if(!pedido)conflito('Solicitação vinculada indisponível.');
    const [veiculo]=await tx`SELECT quilometragem_atual FROM public.veiculo WHERE id=${ref.veiculo_id} FOR UPDATE`;
    const [v]=await tx`SELECT status,veiculo_id::text,km_inicial,km_final,to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim FROM public.viagem WHERE id=${id} AND solicitacao_id=${ref.solicitacao_id} FOR UPDATE`;
    if(!v||!veiculo||v.veiculo_id!==ref.veiculo_id)conflito('Vínculo da viagem indisponível.');
    if(v.status!=='CONCLUIDA')throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Somente viagens concluídas podem ser corrigidas.');
    if(v.km_inicial===null||v.km_final===null||!v.inicio||!v.fim||v.fim<v.inicio)conflito('Dados históricos insuficientes para verificar a correção.');
    const inicial=dados.kmInicial??v.km_inicial,final=dados.kmFinal??v.km_final;
    if(inicial<0||final<0||final<inicial)throw new ErroHttp(400,'DADOS_INVALIDOS','Quilometragens devem ser não negativas e a final não pode ser inferior à inicial.');
    const viagens=await tx<Leitura[]>`SELECT status::text,km_inicial,km_final,to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim FROM public.viagem WHERE veiculo_id=${ref.veiculo_id} AND id<>${id} AND status IN ('EM_TRANSPORTE','CONCLUIDA')`;
    const ordens=await tx<Leitura[]>`SELECT status::text,km_inicial,km_final,to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim FROM public.ordem_coleta WHERE veiculo_id=${ref.veiculo_id} AND status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE','CONCLUIDA')`;
    if(ordens.some(o=>o.status!=='CONCLUIDA'))conflito('Há ordem SVO ativa para o veículo; aguarde a conclusão.');
    let posterior=false;
    for(const leitura of [...viagens,...ordens]) {
      if(!leitura.inicio || (leitura.status==='CONCLUIDA'&&!leitura.fim))conflito('Existem leituras sem horários suficientes para ordenação.');
      if(leitura.fim&&leitura.fim<=v.inicio){
        if(leitura.km_final===null)conflito('Leitura anterior sem quilometragem final.');
        if(inicial<leitura.km_final)conflito('Quilometragem inicial inferior a uma leitura anterior.');
      }else if(leitura.inicio>=v.fim){
        posterior=true;
        if(leitura.km_inicial===null)conflito('Leitura posterior sem quilometragem inicial.');
        if(final>leitura.km_inicial)conflito('Quilometragem final superior a uma leitura posterior.');
      }else conflito('Há utilizações sobrepostas ou sem ordem verificável.');
    }
    const abastecimentos=await tx<{dia:string;quilometragem:number}[]>`SELECT data_abastecimento::text AS dia,quilometragem FROM public.abastecimento WHERE veiculo_id=${ref.veiculo_id}`;
    for(const a of abastecimentos){
      if(a.dia>=v.inicio.slice(0,10)&&a.dia<=v.fim.slice(0,10))conflito('Abastecimento no mesmo período não possui horário suficiente para ordenação.');
      if(a.dia<v.inicio.slice(0,10)&&a.quilometragem>inicial)conflito('Quilometragem inicial inferior a abastecimento anterior.');
      if(a.dia>v.fim.slice(0,10)){posterior=true;if(a.quilometragem<final)conflito('Quilometragem final superior a abastecimento posterior.');}
    }
    let odometroAtualizado=false;
    if(final!==v.km_final){
      if(posterior){
        if(dados.confirmarOdometroAtual===true)conflito('Há leitura posterior; o odômetro não pode ser substituído pela viagem antiga.');
        if(veiculo.quilometragem_atual===null||final>veiculo.quilometragem_atual)conflito('Não foi possível comprovar coerência com o odômetro atual.');
      }else{
        if(dados.confirmarOdometroAtual!==true)conflito('Confirme que a quilometragem final corrigida é a leitura atual do veículo.');
        if(veiculo.quilometragem_atual===null||veiculo.quilometragem_atual!==v.km_final)conflito('Odômetro atual diverge da leitura anterior; é necessária conciliação.');
        await tx`UPDATE public.veiculo SET quilometragem_atual=${final} WHERE id=${ref.veiculo_id}`;
        odometroAtualizado=true;
      }
    }
    const [numero]=await tx`SELECT COALESCE(MAX(versao),0)::int AS versao FROM public.viagem_correcao WHERE viagem_id=${id}`;
    if(numero.versao>=2147483647)conflito('Limite de versões atingido.');
    const [row]=await tx`INSERT INTO public.viagem_correcao(viagem_id,versao,km_inicial_anterior,km_final_anterior,km_inicial,km_final,justificativa,autor_id)
      VALUES (${id},${numero.versao+1},${v.km_inicial},${v.km_final},${inicial},${final},${dados.justificativa},${autorId})
      RETURNING id::text,versao,km_inicial_anterior AS "kmInicialAnterior",km_final_anterior AS "kmFinalAnterior",km_inicial AS "kmInicial",km_final AS "kmFinal",justificativa,autor_id::text AS "autorId",to_char(criado_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "criadoEm"`;
    await tx`UPDATE public.viagem SET km_inicial=${inicial},km_final=${final} WHERE id=${id}`;
    await registrarAtividades(tx,autorId,[{operacao:'solicitacao_viagem_quilometragem_corrigida',recursoId:ref.solicitacao_id}]);
    return {...row,odometroAtualizado};
  });
}
