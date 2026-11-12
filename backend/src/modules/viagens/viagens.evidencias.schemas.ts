import { z } from 'zod';

const camposFoto = {
  nome:z.string().trim().min(1).max(255).refine(nome=>!Array.from(nome).some(ch=>ch==='/' || ch.charCodeAt(0)===92 || ch.charCodeAt(0)<32 || ch.charCodeAt(0)===127)),
  tipo:z.enum(['image/jpeg','image/png']),
  dadosBase64:z.string().min(1).max(1398104).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
};
function validarBytes(entrada:{tipo:string;dadosBase64:string},ctx:z.RefinementCtx) {
  const bytes=Buffer.from(entrada.dadosBase64,'base64');
  const png=bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(bytes.length===0 || bytes.length>1024*1024 || bytes.toString('base64')!==entrada.dadosBase64 || !(entrada.tipo==='image/png'?png:jpeg)) {
    ctx.addIssue({code:'custom',path:['dadosBase64'],message:'Envie uma imagem JPEG ou PNG válida de até 1 MiB.'});
  }
}
/** Fotografia estrita, com limite anterior à decodificação e assinatura compatível. */
export const evidenciaArquivoSchema=z.strictObject(camposFoto).superRefine(validarBytes);
/** O momento é definido pela operação autorizada, nunca pelo cliente da execução. */
export const evidenciaEntradaSchema=z.strictObject({momento:z.enum(['INICIAL','FINAL']),...camposFoto}).superRefine(validarBytes);
/** Metadados públicos não contêm bytes ou dados pessoais do autor. */
export const evidenciaMetadadosSchema = z.object({
  id:z.string(), momento:z.enum(['INICIAL','FINAL']), versao:z.number().int().positive(),
  nome:z.string(), tipo:z.enum(['image/jpeg','image/png']), enviadoPorId:z.string(), criadoEm:z.iso.datetime(),
});
/** Resposta interna binária; o contrato HTTP descreve imagem, não JSON. */
export const evidenciaBinariaSchema = z.object({ tipo:z.enum(['image/jpeg','image/png']), dados:z.instanceof(Buffer) });
