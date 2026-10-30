import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { errorMessage } from './errors';

/** Estado remoto separado dos filtros/modais; respostas de ciclos encerrados são ignoradas. */
export function useRemoteData<T>(load:(signal:AbortSignal)=>Promise<T>, initial:T) {
  const [data,setData] = useState<T>(initial);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  const active = useRef<AbortController | null>(null);
  useEffect(()=>{
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError('');
    void load(controller.signal).then(value=>{
      if (!controller.signal.aborted) setData(value);
    }).catch(reason=>{
      if (!controller.signal.aborted) setError(errorMessage(reason));
    }).finally(()=>{
      if (!controller.signal.aborted) setLoading(false);
    });
    return ()=>controller.abort();
  },[load,attempt]);
  // Uma escrita confirmada vence uma consulta iniciada antes dela.
  function commit(value:SetStateAction<T>) {
    active.current?.abort();
    setLoading(false);
    setData(value);
  }
  return {data,setData:commit,loading,error,setError,retry:()=>setAttempt(value=>value+1)};
}
