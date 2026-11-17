import {pngViagem,jpegViagem,pngViagemDeTamanho} from '../viagens-imagens.js';
import { describe,expect,test } from 'vitest';
import { evidenciaEntradaSchema } from '../../src/modules/viagens/viagens.evidencias.schemas.js';
const png=pngViagem;
const jpeg=jpegViagem;
const entrada={momento:'INICIAL',nome:'odometro.png',tipo:'image/png',dadosBase64:png.toString('base64')};
describe('validação independente de evidência fotográfica',()=>{
  test('aceita PNG e JPEG com bytes e tipo correspondentes',()=>{
    expect(evidenciaEntradaSchema.parse(entrada).dadosBase64).toBe(png.toString('base64'));
    expect(evidenciaEntradaSchema.safeParse({...entrada,tipo:'image/jpeg',dadosBase64:jpeg.toString('base64')}).success).toBe(true);
  });
  test.each([
    {dadosBase64:''},{dadosBase64:'!!!'},{dadosBase64:'AAAA'},{tipo:'image/jpeg'},
    {nome:'../arquivo.png'},{nome:'arquivo\u0000.png'},{momento:'OUTRO'},{adicional:true},
    {dadosBase64:Buffer.concat([png,Buffer.alloc(1024*1024)]).toString('base64')},
  ])('rejeita entrada inválida %#',patch=>{
    expect(evidenciaEntradaSchema.safeParse({...entrada,...patch}).success).toBe(false);
  });
  test('aceita o limite exato de 1 MiB',()=>{
    const bytes=pngViagemDeTamanho(1024*1024);
    expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:bytes.toString('base64')}).success).toBe(true);
  });
});

test('rejeita arquivos contendo apenas assinatura de imagem',()=>{
  for(const [tipo,bytes] of [['image/png',Buffer.from([137,80,78,71,13,10,26,10])],['image/jpeg',Buffer.from([255,216,255])]] as const) {
    expect(evidenciaEntradaSchema.safeParse({...entrada,tipo,dadosBase64:bytes.toString('base64')}).success).toBe(false);
  }
});

test('aceita JPEG valido com bytes apos fim e rejeita PNG sem IEND',()=>{
  const jpegComDados=Buffer.concat([jpegViagem,Buffer.from([1,2,3])]);
  expect(evidenciaEntradaSchema.safeParse({...entrada,tipo:'image/jpeg',dadosBase64:jpegComDados.toString('base64')}).success).toBe(true);
  expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:pngViagem.subarray(0,-12).toString('base64')}).success).toBe(false);
});

/** Atualiza o CRC do IHDR para testar os campos independentemente da integridade do chunk. */
function atualizarCrcIhdr(bytes:Buffer):Buffer {
  let crc=0xffffffff;
  for(const byte of bytes.subarray(12,29)){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,29);
  return bytes;
}

test('rejeita PNG sem IHDR e com IHDR truncado ou tamanho invalido',()=>{
  const assinaturaEIend=Buffer.concat([png.subarray(0,8),Buffer.alloc(13),png.subarray(-12)]);
  const semIhdr=Buffer.concat([png.subarray(0,8),png.subarray(33)]);
  const truncado=Buffer.concat([png.subarray(0,25),png.subarray(-12)]);
  const tamanhoInvalido=Buffer.from(png);tamanhoInvalido.writeUInt32BE(12,8);
  for(const dados of [assinaturaEIend,semIhdr,truncado,tamanhoInvalido])expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:dados.toString('base64')}).success).toBe(false);
});

test('rejeita IHDR com dimensoes ou campos invalidos e CRC incorreto',()=>{
  const imagens:Buffer[]=[];
  for(const alterar of [(b:Buffer)=>b.writeUInt32BE(0,16),(b:Buffer)=>b.writeUInt32BE(0,20),(b:Buffer)=>{b[24]=1;},(b:Buffer)=>{b[26]=1;},(b:Buffer)=>{b[27]=1;},(b:Buffer)=>{b[28]=2;}]){
    const bytes=Buffer.from(png);alterar(bytes);imagens.push(atualizarCrcIhdr(bytes));
  }
  const crc=Buffer.from(png);crc[29]^=1;imagens.push(crc);
  for(const dados of imagens)expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:dados.toString('base64')}).success).toBe(false);
});

test('rejeita PNG sem IDAT ou com bloco truncado',()=>{
  const semDados=Buffer.concat([png.subarray(0,33),png.subarray(-12)]);
  const blocoTruncado=Buffer.from(png);blocoTruncado.writeUInt32BE(1000,33);
  const nomeInvalido=Buffer.from(png);nomeInvalido[37]|=128;
  for(const dados of [semDados,blocoTruncado,nomeInvalido])expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:dados.toString('base64')}).success).toBe(false);
});
