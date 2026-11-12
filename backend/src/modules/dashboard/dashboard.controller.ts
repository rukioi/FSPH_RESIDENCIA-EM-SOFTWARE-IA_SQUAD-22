import { obterDashboardConsolidado } from './dashboard.consolidado.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import type { ServerResponse } from 'node:http';
import {obterIndicadores} from './dashboard.service.js';
import {responderErroHttp} from '../../shared/http/errors.js';
import { buscarPendencias } from './dashboard.pendencias.js';

/** Responde indicadores persistidos pela visão autorizada; falha não vira dado vazio. */
export async function dashboardController(response: ServerResponse,perfil:string,params:URLSearchParams): Promise<void> {
  try { jsonCompartilhado(response,200,await obterDashboardConsolidado(perfil,params)); }
  catch(error) { tratarErroTecnico(response,error); }
}

/** Consulta pendências existentes com falhas técnicas seguras. */
export async function pendenciasController(
  response: ServerResponse
): Promise<void> {
  try {
    const pendencias = await buscarPendencias();

    jsonCompartilhado(response, 200, {
        data: pendencias,
      });
  } catch (erro) {
    registrarFalha(erro);

    jsonCompartilhado(response, 500, {
        error: {
          code: 'ERRO_INTERNO',
          message: 'Não foi possível consultar as pendências.',
        },
      });
  }
}

/** Publica gráficos reais no mesmo snapshot e preserva o envelope de falha existente. */
export async function dashboardGraficosController(response:ServerResponse,params=new URLSearchParams()):Promise<void>{
  try{jsonCompartilhado(response,200,await obterIndicadores(params,false));}
  catch(erro){if(responderErroHttp(response,erro))return;registrarFalha(erro);jsonCompartilhado(response,500,{error:{code:'FALHA_INTERNA',message:'Erro inesperado ao processar os dados dos gráficos.'}});}
}

/** Publica fila atual, coorte por saída e indisponibilidade explícita sem fabricar elegibilidade. */
export async function dashboardGestorController(response:ServerResponse,params=new URLSearchParams()):Promise<void>{
  try{jsonCompartilhado(response,200,await obterIndicadores(params,true));}
  catch(erro){if(responderErroHttp(response,erro))return;registrarFalha(erro);jsonCompartilhado(response,500,{error:{code:'ERRO_INTERNO',message:'Erro inesperado ao processar os dados do dashboard.'}});}
}
