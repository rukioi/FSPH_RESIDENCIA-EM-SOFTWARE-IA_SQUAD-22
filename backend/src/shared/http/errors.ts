import type { ServerResponse } from 'node:http';
import { ErroCorpoRequisicao } from './body.js';
import { enviarErro, enviarJson } from './json.js';
import { registrarFalha } from '../logging/logger.js';

/** Erro técnico/de domínio conhecido, seguro para adaptar aos envelopes HTTP existentes. */
export class ErroHttp extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string,
    public readonly fields?: Record<string,string>) { super(message); this.name = 'ErroHttp'; }
}

/** Adapta um erro conhecido sem serializar cause, stack ou objetos de banco. */
export function responderErroHttp(res: ServerResponse, erro: unknown): boolean {
  if (!(erro instanceof ErroHttp)) return false;
  enviarJson(res,erro.status,{error:{code:erro.code,message:erro.message,...(erro.fields ? {fields:erro.fields} : {})}});
  return true;
}

/** Responde falhas do corpo com adaptador opcional para o envelope legado do SVO. */
export function responderErroCorpo(res: ServerResponse, erro: unknown, legado = false): boolean {
  if (!(erro instanceof ErroCorpoRequisicao)) return false;
  if (erro.codigo === 'CONEXAO_INTERROMPIDA') return true;
  const status = erro.codigo === 'CORPO_MUITO_GRANDE' ? 413 : erro.codigo === 'TIPO_NAO_SUPORTADO' ? 415 : 400;
  const message = erro.codigo === 'CORPO_MUITO_GRANDE' ? 'Corpo da requisição muito grande.'
    : erro.codigo === 'TIPO_NAO_SUPORTADO' ? 'Envie o corpo como application/json.'
    : erro.codigo === 'JSON_INVALIDO' ? 'Envie um JSON válido.' : 'Não foi possível ler o corpo da requisição.';
  const mensagemLegada = erro.codigo === 'CORPO_MUITO_GRANDE' ? 'O corpo da requisição excede o limite de 64 KB.'
    : erro.codigo === 'JSON_INVALIDO' ? 'O corpo da requisição precisa ser um JSON válido.' : message;
  if (legado) enviarJson(res, status, { erro: mensagemLegada });
  else enviarErro(res, status, erro.codigo, message);
  return true;
}

/** Isola erros inesperados sem expor driver, payload ou stack. */
export function tratarErroTecnico(res: ServerResponse, erro: unknown): void {
  if (responderErroHttp(res, erro)) return;
  if (responderErroCorpo(res, erro)) return;
  registrarFalha(erro);
  if (res.headersSent) { if (!res.writableEnded) res.destroy(); return; }
  enviarErro(res, 500, 'ERRO_INTERNO', 'Não foi possível concluir a requisição.');
}
