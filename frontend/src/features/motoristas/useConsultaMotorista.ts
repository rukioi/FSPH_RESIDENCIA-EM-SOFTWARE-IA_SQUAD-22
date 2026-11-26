import { useCallback, useEffect, useRef, useState } from 'react';
import { dataRevision, onDataChanged } from '../../shared/api/dataChanges';
import { errorMessage } from '../../shared/api/errors';
import { obterToken } from '../../shared/services/auth.service';

/** Nunca publica uma resposta de outra sessão ou anterior a uma escrita confirmada. */
export function useConsultaMotorista<T>(consultar: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const ativa = useRef<AbortController | null>(null);
  const atualizar = useCallback(() => {
    ativa.current?.abort();
    setErro(''); setCarregando(true);
    setTentativa(valor => valor + 1);
  }, []);
  useEffect(() => onDataChanged(atualizar), [atualizar]);
  useEffect(() => {
    const controller = new AbortController();
    const token = obterToken();
    const revisao = dataRevision();
    ativa.current = controller;
    setCarregando(true); setErro('');
    const atual = () => !controller.signal.aborted && token === obterToken() && revisao === dataRevision();
    void consultar(controller.signal).then(resultado => {
      if (atual()) setData(resultado);
    }).catch(motivo => {
      if (atual()) setErro(errorMessage(motivo));
    }).finally(() => { if (atual()) setCarregando(false); });
    return () => controller.abort();
  }, [consultar, tentativa]);
  return { data, carregando, erro, atualizar };
}
