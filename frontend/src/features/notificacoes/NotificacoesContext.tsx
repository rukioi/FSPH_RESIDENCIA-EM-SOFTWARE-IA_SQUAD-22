import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useCaminho } from '../../app/routes/router';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { errorMessage } from '../../shared/api/errors';
import { onDataChanged } from '../../shared/api/dataChanges';
import { obterToken } from '../../shared/services/auth.service';
import { buscarNotificacoes, lerNotificacoes, sincronizarNotificacoes, type CaixaNotificacoes, type FiltroNotificacoes } from '../../shared/services/notificacoes.service';

const vazia: CaixaNotificacoes = {data:[],meta:{page:1,limit:20,total:0,naoLidas:0}};
function useCaixa(ativo: boolean) {
  const caminho = useCaminho();
  const token = obterToken();
  const [filtro,setFiltro] = useState<FiltroNotificacoes>('todas');
  const [page,setPage] = useState(1);
  const [salvando,setSalvando] = useState(false);
  const [erroAcao,setErroAcao] = useState('');
  const escrita = useRef<AbortController | null>(null);
  const sincronizacoes = useRef(0);
  const carregar = useCallback(async (signal: AbortSignal) => {
    if (!ativo || !token || caminho === '/login') return vazia;
    sincronizacoes.current++;
    try { await sincronizarNotificacoes(signal); }
    finally { sincronizacoes.current--; }
    return buscarNotificacoes(filtro,page,signal);
  },[ativo,token,caminho,filtro,page]);
  const remote = useRemoteData(carregar,vazia);
  const retryRef = useRef(remote.retry);
  retryRef.current = remote.retry;
  useEffect(()=>{
    if (!ativo) return;
    const atualizar = () => { if (document.visibilityState === 'visible' && !escrita.current) retryRef.current(); };
    const timer = window.setInterval(atualizar,60000);
    const cancelar = onDataChanged(()=>{
      if (!sincronizacoes.current && !escrita.current) retryRef.current();
    });
    window.addEventListener('focus',atualizar);
    return ()=>{cancelar();window.clearInterval(timer);window.removeEventListener('focus',atualizar);};
  },[ativo]);
  useEffect(()=>{
    if (!ativo) remote.setData(vazia);
    setErroAcao('');setSalvando(false);
    return ()=>{escrita.current?.abort();escrita.current=null;};
  },[ativo,token,caminho,filtro,page]);
  async function ler(id?: string) {
    if (!ativo || !token || escrita.current) return;
    const controller = new AbortController();
    escrita.current=controller;setSalvando(true);setErroAcao('');
    try {
      await lerNotificacoes(id,controller.signal);
      if (!controller.signal.aborted) {
        const lidaEm = new Date().toISOString();
        remote.setData(atual => {
          const atualizadas = id ? atual.data.filter(n => n.id === id && !n.lidaEm).length : atual.data.filter(n => !n.lidaEm).length;
          if (id && !atualizadas) return atual;
          const data = id
            ? atual.data.map(n => n.id === id ? {...n,lidaEm} : n)
            : atual.data.map(n => n.lidaEm ? n : {...n,lidaEm});
          if (!id) return { ...atual, data: filtro === 'nao-lidas' ? [] : data,
            meta: { ...atual.meta, total: filtro === 'nao-lidas' ? 0 : atual.meta.total, naoLidas: 0 } };
          const removidas = filtro === 'nao-lidas' ? atualizadas : 0;
          return { ...atual, data: removidas ? data.filter(n => n.id !== id) : data,
            meta: { ...atual.meta, total: atual.meta.total - removidas,
              naoLidas: Math.max(0, atual.meta.naoLidas - atualizadas) } };
        });
        if (!id && filtro === 'lidas') remote.retry();
      }
    } catch (erro) { if (!controller.signal.aborted) setErroAcao(errorMessage(erro)); }
    finally { if (!controller.signal.aborted) {escrita.current=null;setSalvando(false);} }
  }
  return {...remote, data:ativo && token ? remote.data : vazia, filtro,page,setPage,
    filtrar:(valor: FiltroNotificacoes)=>{setFiltro(valor);setPage(1);},ler,salvando,erroAcao};
}
const Contexto = createContext<ReturnType<typeof useCaixa> | null>(null);
/** Compartilha caixa e contador entre o cabeçalho e a página, somente em memória. */
export function NotificacoesProvider({children,ativo}:{children:ReactNode;ativo:boolean}) {
  const caixa = useCaixa(ativo);
  return <Contexto.Provider value={caixa}>{children}</Contexto.Provider>;
}
/** Acessa a caixa da sessão atual. */
export function useNotificacoes() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Caixa de notificações não inicializada.');
  return contexto;
}
