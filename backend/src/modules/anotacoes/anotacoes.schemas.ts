import { z } from 'zod';
import { dados, id, meta } from '../../shared/contract/schemas.js';
import { paginacaoAnexo, registroId } from '../anexos/anexos.schemas.js';
export const tipoNota = z.enum(['SOLICITACAO_VIAGEM','SOLICITACAO_SVO','VIAGEM','ORDEM_SVO','VEICULO']);
const vinculo = z.object({ tipoRegistro:tipoNota, registroId }).strict();
export const consultaNotas = vinculo.extend(paginacaoAnexo.shape);
export const criarNota = vinculo.extend({ texto:z.string().trim().min(1).max(2000)
  .refine(v=>![...v].some(c=>{const n=c.charCodeAt(0);return (n<32&&![9,10,13].includes(n))||n===127;})) });
const nota = vinculo.extend({ id, texto:z.string().min(1).max(2000), autorId:id, criadoEm:z.iso.datetime() });
export const anotacoesSchemas = { CriarAnotacao:criarNota, Anotacao:nota,
  RespostaAnotacao:dados(nota), ListaAnotacoes:dados(z.array(nota)).extend({meta}) };
