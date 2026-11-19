import { expect, test } from 'vitest';
import { openapi } from '../../src/shared/contract/openapi.js';
import { checkCompatibility } from '../../../scripts/generate-api.js';

function anterior() {
  const doc = openapi();
  const normalize = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string,unknown>;
    for (const [key,item] of Object.entries(obj)) {
      if (['motorista_id','quilometragem'].includes(key) && item && typeof item === 'object') {
        const shape = item as {anyOf?: unknown[]};
        if (shape.anyOf?.length === 2 && JSON.stringify(shape.anyOf[1]) === JSON.stringify({type:'null'})) obj[key] = shape.anyOf[0];
      }
      normalize(obj[key]);
    }
  };
  for (const name of ['Abastecimento','RespostaAbastecimento','Abastecimentos']) normalize(doc.components.schemas[name]);
  return doc;
}

test('aceita apenas os campos opcionais autorizados nas respostas',()=>{
  checkCompatibility(anterior(),openapi());
});
test.each(['placa','quilometragem','metodo','autorizacao'] as const)('rejeita alteração adicional em %s',tipo=>{
  const before=anterior(), current=openapi();
  const properties = (current.components.schemas.Abastecimento as {properties: Record<string,unknown>}).properties; if(tipo==='placa') properties.veiculo_id={type:'integer'};
  if(tipo==='quilometragem') properties.quilometragem={type:'string'};
  if(tipo==='metodo') delete current.paths['/api/abastecimentos'].post;
  if(tipo==='autorizacao') (current.paths['/api/abastecimentos'].post as {security:unknown[]}).security=[];
  expect(()=>checkCompatibility(before,current)).toThrow();
});