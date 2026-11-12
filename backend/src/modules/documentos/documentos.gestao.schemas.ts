import { z } from 'zod';
import { dados,id,meta } from '../../shared/contract/schemas.js';
import { registroId,paginacaoAnexo } from '../anexos/anexos.schemas.js';
import { dataCivilAbastecimento as dataCivil } from '../abastecimentos/abastecimentos.schemas.js';
export const tipoDocumental=z.enum(['DOCUMENTO_VEICULO','CNH_MOTORISTA']);
export const consultaDocumental=z.object({tipo:tipoDocumental.optional(),veiculoId:registroId.optional(),motoristaId:registroId.optional(),
  situacao:z.enum(['VENCIDO','HOJE','A_VENCER']).optional(),inicio:dataCivil.optional(),fim:dataCivil.optional(),
  ...paginacaoAnexo.shape}).strict().refine(q=>!q.inicio||!q.fim||q.inicio<=q.fim);
export const alterarDocumento=z.object({versao:z.number().int().min(0),dataValidade:dataCivil,
  tipoDocumento:z.string().trim().min(1).max(50).optional(),numeroCnh:z.string().trim().min(1).max(20).optional(),
  categoriaCnh:z.enum(['A','B','C','D','E']).optional(),anexoId:registroId.nullable().optional()}).strict();
const item=z.object({id,tipo:tipoDocumental,registroId:id.nullable(),dataValidade:dataCivil,
  tipoDocumento:z.string().nullable(),numeroCnh:z.string().nullable(),categoriaCnh:z.string().nullable(),
  regular:z.boolean().nullable(),diasRestantes:z.number().int(),versao:z.number().int().min(0)});
const versao=z.object({id,versao:z.number().int().positive(),dataValidade:dataCivil,tipoDocumento:z.string().nullable(),
  numeroCnh:z.string().nullable(),categoriaCnh:z.string().nullable(),regular:z.boolean().nullable(),
  anexoId:id.nullable(),autorId:id,criadoEm:z.iso.datetime()});
export const gestaoDocumentalSchemas={DocumentoAtual:item,ListaDocumental:dados(z.array(item)).extend({meta}),
  DetalheDocumental:dados(item),HistoricoDocumental:dados(z.array(versao)).extend({meta}),AlterarDocumento:alterarDocumento};
export const parametrosDocumentais=[{name:'tipo',required:false,schema:tipoDocumental},
  {name:'veiculoId',required:false,schema:registroId},{name:'motoristaId',required:false,schema:registroId},
  {name:'situacao',required:false,schema:z.enum(['VENCIDO','HOJE','A_VENCER'])},
  {name:'inicio',required:false,schema:dataCivil},{name:'fim',required:false,schema:dataCivil},
  {name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
  {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}];
