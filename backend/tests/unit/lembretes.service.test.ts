import {afterEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({gerar:vi.fn(),falha:vi.fn()}));
vi.mock('../../src/modules/notificacoes/lembretes.repository.js',()=>({gerarLembretes:mocks.gerar}));
vi.mock('../../src/shared/logging/logger.js',()=>({registrarFalha:mocks.falha}));
import {iniciarLembretes} from '../../src/modules/notificacoes/lembretes.service.js';
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.clearAllMocks();});
test('verifica imediatamente, repete sem sobreposicao e para',async()=>{
  vi.useFakeTimers();vi.stubEnv('LEMBRETE_ANTECEDENCIA_MINUTOS','30');vi.stubEnv('LEMBRETE_INTERVALO_SEGUNDOS','60');
  mocks.gerar.mockResolvedValue(0);const parar=iniciarLembretes();await vi.advanceTimersByTimeAsync(0);
  expect(mocks.gerar).toHaveBeenCalledTimes(1);expect(mocks.gerar).toHaveBeenCalledWith(30);
  await vi.advanceTimersByTimeAsync(60000);expect(mocks.gerar).toHaveBeenCalledTimes(2);
  await parar();await vi.advanceTimersByTimeAsync(120000);expect(mocks.gerar).toHaveBeenCalledTimes(2);
});
test('reinicializacao verifica novamente e erros nao interrompem o ciclo',async()=>{
  vi.useFakeTimers();vi.stubEnv('LEMBRETE_INTERVALO_SEGUNDOS','60');mocks.gerar.mockRejectedValueOnce(new Error('fixture')).mockResolvedValue(0);
  const parar=iniciarLembretes();await vi.advanceTimersByTimeAsync(0);expect(mocks.falha).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);expect(mocks.gerar).toHaveBeenCalledTimes(2);await parar();
  const pararDeNovo=iniciarLembretes();await vi.advanceTimersByTimeAsync(0);expect(mocks.gerar).toHaveBeenCalledTimes(3);await pararDeNovo();
});

test('aguarda processamento ativo antes de repetir ou encerrar',async()=>{
  vi.useFakeTimers();vi.stubEnv('LEMBRETE_INTERVALO_SEGUNDOS','1');
  let liberar:(v:number)=>void=()=>{};mocks.gerar.mockImplementationOnce(()=>new Promise<number>(resolve=>{liberar=resolve;}));
  const parar=iniciarLembretes();await vi.advanceTimersByTimeAsync(5000);expect(mocks.gerar).toHaveBeenCalledTimes(1);
  let terminou=false;const encerramento=parar().then(()=>{terminou=true;});await Promise.resolve();expect(terminou).toBe(false);
  liberar(0);await encerramento;expect(terminou).toBe(true);await vi.advanceTimersByTimeAsync(5000);expect(mocks.gerar).toHaveBeenCalledTimes(1);
});
