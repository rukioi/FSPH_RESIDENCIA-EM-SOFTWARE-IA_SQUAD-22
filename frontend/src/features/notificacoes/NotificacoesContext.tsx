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
  // A última página pode desaparecer após leituras ou mudanças no servidor.
  useEffect(()=>{
    if (!ativo || remote.loading || remote.error || remote.data.meta.page !== page) return;
    const ultimaPagina = Math.max(1, Math.ceil(remote.data.meta.total / remote.data.meta.limit));
    if (page > ultimaPagina) setPage(ultimaPagina);
  },[ativo,remote.loading,remote.error,remote.data.meta.page,remote.data.meta.total,remote.data.meta.limit,page]);
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
    document.addEventListener('visibilitychange',atualizar);
    return ()=>{cancelar();window.clearInterval(timer);window.removeEventListener('focus',atualizar);document.removeEventListener('visibilitychange',atualizar);};
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
        // O GET confirma datas, contador global, filtro e paginação no servidor.
        // Não cria lidaEm no navegador nem deixa uma página parcialmente vazia.
        remote.setData(atual => atual);
        remote.retry();
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
  // Remonta a caixa antes de renderizar outra sessão; nenhuma caixa anterior é reutilizada.
  const token = obterToken();
  return <CaixaDaSessao key={ativo && token ? token : 'sem-sessao'} ativo={ativo}>{children}</CaixaDaSessao>;
}
function CaixaDaSessao({children,ativo}:{children:ReactNode;ativo:boolean}) {
  const caixa = useCaixa(ativo);
  return <Contexto.Provider value={caixa}>{children}</Contexto.Provider>;
}
/** Acessa a caixa da sessão atual. */
export function useNotificacoes() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Caixa de notificações não inicializada.');
  return contexto;
}
