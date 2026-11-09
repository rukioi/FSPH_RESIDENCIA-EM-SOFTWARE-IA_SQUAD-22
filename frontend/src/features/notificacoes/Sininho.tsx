import { navegar } from '../../app/routes/router';
import { ROTAS } from '../../app/routes/rotas';
import { Icone } from '../../shared/components/Icone';
import { useNotificacoes } from './NotificacoesContext';
import './Notificacoes.css';

/** Abre a caixa; contador reflete a resposta validada do servidor. */
export function Sininho() {
  const {data,loading,error} = useNotificacoes();
  const total = data.meta.naoLidas;
  return <button type="button" className="botao-icone notificacoes-sininho"
    aria-label={error ? 'Abrir notificações: não foi possível atualizar' : loading ? 'Abrir notificações: atualizando' : `Abrir notificações: ${total} não lidas`}
    title="Abrir notificações" onClick={()=>navegar(ROTAS.notificacoes)}>
    <Icone nome="notificacoes" />
    {!error && total>0 && <span className="selo" aria-hidden="true">{total>99?'99+':total}</span>}
    {error && <span className="notificacoes-sininho__erro" aria-hidden="true">!</span>}
  </button>;
}
