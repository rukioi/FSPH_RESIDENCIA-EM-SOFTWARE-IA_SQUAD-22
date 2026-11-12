import { describe,expect,test } from 'vitest';
import { evidenciaEntradaSchema } from '../../src/modules/viagens/viagens.evidencias.schemas.js';
const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
const jpeg=Buffer.from([255,216,255,1,2,3]);
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
    const bytes=Buffer.alloc(1024*1024);png.copy(bytes);
    expect(evidenciaEntradaSchema.safeParse({...entrada,dadosBase64:bytes.toString('base64')}).success).toBe(true);
  });
});
