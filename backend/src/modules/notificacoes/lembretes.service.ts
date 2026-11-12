import { inteiroAmbiente } from '../../config/environment.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { gerarLembretes } from './lembretes.repository.js';

/** Inicia verificacoes automaticas sem sobreposicao; parar aguarda o lote em andamento. */
export function iniciarLembretes() {
  const antecedencia=inteiroAmbiente('LEMBRETE_ANTECEDENCIA_MINUTOS',30,10080);
  const intervalo=inteiroAmbiente('LEMBRETE_INTERVALO_SEGUNDOS',60,3600)*1000;
  let parado=false;
  let timer:NodeJS.Timeout|undefined;
  let atual:Promise<void>|undefined;
  const executar=()=>{
    if(parado)return;
    atual=(async()=>{
      try { let total:number; do { total=await gerarLembretes(antecedencia); } while(!parado && total===100); }
      catch(erro){ registrarFalha(erro); }
    })().finally(()=>{if(!parado){timer=setTimeout(executar,intervalo);timer.unref();}});
  };
  executar();
  return async()=>{parado=true;if(timer)clearTimeout(timer);await atual;};
}
