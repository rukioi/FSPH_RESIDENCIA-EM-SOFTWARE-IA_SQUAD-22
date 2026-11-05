import type { ServerResponse } from 'node:http';
import { enviarJson } from '../../shared/http/json.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import {
  filtroDashboardSvo, filtroAtividadesSvo, parseLimiteAtividades,
} from './svo.dashboard.schemas.js';
import {
  consultarDashboardSvo, consultarFilasSvo, consultarAtividadesSvo,
} from './svo.dashboard.repository.js';

function leituraEstrita(params: URLSearchParams): Record<string, string> | null {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of params) {
    if (Object.hasOwn(result,key)) return null;
    result[key]=value;
  }
  return result;
}
function falha(response: ServerResponse, error: unknown): void {
  registrarFalha(error);
  enviarJson(response,500,{error:{code:'ERRO_INTERNO',message:'Não foi possível consultar os indicadores SVO.'}});
}

/** Apenas ATENDENTE_SVO (autorização aplicada na rota antes de chamar o controller). */
export async function dashboardSvoController(response: ServerResponse, params: URLSearchParams): Promise<void> {
  const raw = leituraEstrita(params);
  const parsed = raw===null ? null : filtroDashboardSvo.safeParse(raw);
  if(!parsed?.success){enviarJson(response,400,{erro:'Período inválido.'});return;}
  try { enviarJson(response,200,await consultarDashboardSvo(parsed.data.periodo)); }
  catch(error){falha(response,error);}
}

export async function filasSvoController(response: ServerResponse, params: URLSearchParams): Promise<void> {
  if([...params.keys()].length){enviarJson(response,400,{erro:'Parâmetros não permitidos.'});return;}
  try { enviarJson(response,200,await consultarFilasSvo()); }
  catch(error){falha(response,error);}
}

export async function atividadesSvoController(response: ServerResponse, params: URLSearchParams): Promise<void> {
  const raw=leituraEstrita(params);
  const parsed=raw===null ? null : filtroAtividadesSvo.safeParse(raw);
  const limite=parsed?.success ? parseLimiteAtividades(parsed.data.limite) : null;
  if(limite===null){enviarJson(response,400,{erro:'Limite de atividades inválido.'});return;}
  try { enviarJson(response,200,await consultarAtividadesSvo(limite)); }
  catch(error){falha(response,error);}
}
