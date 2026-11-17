import { z } from 'zod';

const camposFoto = {
  nome:z.string().trim().min(1).max(255).refine(nome=>!Array.from(nome).some(ch=>ch==='/' || ch.charCodeAt(0)===92 || ch.charCodeAt(0)<32 || ch.charCodeAt(0)===127)),
  tipo:z.enum(['image/jpeg','image/png']),
  dadosBase64:z.string().min(1).max(1398104).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
};
/** Confere IHDR e limites dos chunks sem decodificar ou modificar a imagem. */
function pngEstruturalmenteValido(bytes:Buffer):boolean {
  if(bytes.length<57 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
    bytes.readUInt32BE(8)!==13 || !bytes.subarray(12,16).equals(Buffer.from('IHDR')))return false;
  const largura=bytes.readUInt32BE(16),altura=bytes.readUInt32BE(20),profundidade=bytes[24],cor=bytes[25];
  const profundidades:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
  if(largura===0 || altura===0 || largura>2147483647 || altura>2147483647 ||
    !profundidades[cor]?.includes(profundidade) || bytes[26]!==0 || bytes[27]!==0 || bytes[28]>1)return false;
  let crc=0xffffffff;
  for(const byte of bytes.subarray(12,29)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(29))return false;
  let posicao=33,dadosImagem=false;
  while(posicao+12<=bytes.length){
    const tamanho=bytes.readUInt32BE(posicao),fim=posicao+12+tamanho;
    if(fim>bytes.length)return false;
    const nome=bytes.subarray(posicao+4,posicao+8);
    if(!nome.every(c=>(c>=65 && c<=90)||(c>=97 && c<=122)))return false;
    const tipo=nome.toString('ascii');
    if(tipo==='IHDR')return false;
    if(tipo==='IDAT' && tamanho>0)dadosImagem=true;
    if(tipo==='IEND')return tamanho===0 && dadosImagem && fim===bytes.length && bytes.subarray(posicao,fim).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]));
    posicao=fim;
  }
  return false;
}
function validarBytes(entrada:{tipo:string;dadosBase64:string},ctx:z.RefinementCtx) {
  const bytes=Buffer.from(entrada.dadosBase64,'base64');
  const png=entrada.tipo==='image/png' && bytes.length<=1024*1024 && pngEstruturalmenteValido(bytes);
  const jpeg=bytes.length>4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.indexOf(Buffer.from([255,217]),3)!==-1;
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
