import {expect,test,vi} from 'vitest';
const falha=new Error('Falha técnica deliberada do agregador');
vi.mock('../../src/modules/dashboard/dashboard.service.js',()=>({obterIndicadores:vi.fn()}));
import {obterIndicadores} from '../../src/modules/dashboard/dashboard.service.js';
import {obterDashboardConsolidado} from '../../src/modules/dashboard/dashboard.consolidado.js';

test('teste unitário: falha do módulo é propagada, não retorna métricas vazias ou zero',async()=>{
  vi.mocked(obterIndicadores).mockRejectedValueOnce(falha);
  await expect(obterDashboardConsolidado('ADM',new URLSearchParams())).rejects.toBe(falha);
  expect(obterIndicadores).toHaveBeenCalledTimes(1);
});
test('teste unitário: serviço recusa perfil externo antes de consultar dados',async()=>{
  vi.mocked(obterIndicadores).mockClear();
  await expect(obterDashboardConsolidado('MOTORISTA',new URLSearchParams())).rejects.toMatchObject({status:403});
  expect(obterIndicadores).not.toHaveBeenCalled();
});
