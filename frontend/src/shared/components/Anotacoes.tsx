import { useCallback, useState, type FormEvent } from 'react';
import { useRemoteData } from '../api/useRemoteData';
import { errorMessage } from '../api/errors';
import { criarAnotacao, listarAnotacoes, LIMITE_TEXTO_NOTA, type TipoRegistroNota } from '../services/anotacoes.service';
import './Anotacoes.css';

type AnotacoesProps = { tipoRegistro: TipoRegistroNota; registroId: string };
const LIMITE_POR_PAGINA = 20;

function dataHora(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Maceio' }).format(new Date(valor));
}

/**
 * Notas privadas (RF48) de um registro. Só lista e adiciona: o backend não oferece edição/exclusão
 * e a nota não muda o estado do registro. O texto é renderizado como texto (sem HTML).
 */
export function Anotacoes({ tipoRegistro, registroId }: AnotacoesProps) {
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [mensagem, setMensagem] = useState('');
  const load = useCallback((signal: AbortSignal) => listarAnotacoes({ tipoRegistro, registroId }, pagina, LIMITE_POR_PAGINA, signal), [tipoRegistro, registroId, pagina]);
  const lista = useRemoteData(load, null);
  const totalPaginas = lista.data ? Math.max(1, Math.ceil(lista.data.meta.total / lista.data.meta.limit)) : 1;
  const idCampo = `anotacao-${tipoRegistro}-${registroId}`;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroEnvio(''); setMensagem(''); setEnviando(true);
    try {
      await criarAnotacao({ tipoRegistro, registroId }, texto);
      setTexto(''); // só limpa depois da confirmação do servidor
      setMensagem('Anotação adicionada.');
      if (pagina === 1) lista.retry(); else setPagina(1);
    } catch (error) {
      setErroEnvio(errorMessage(error)); // o texto digitado é mantido
    } finally {
      setEnviando(false);
    }
  }

  return <div className="anotacoes">
    <form className="anotacoes__form" onSubmit={enviar}>
      <label htmlFor={idCampo}>Nova anotação</label>
      <textarea id={idCampo} value={texto} maxLength={LIMITE_TEXTO_NOTA} rows={3} disabled={enviando}
        onChange={e => { setTexto(e.target.value); setErroEnvio(''); setMensagem(''); }} />
      <div className="anotacoes__rodape">
        <small>{texto.length}/{LIMITE_TEXTO_NOTA.toLocaleString('pt-BR')} · Não inclua dados pessoais desnecessários.</small>
        <button type="submit" disabled={enviando || !texto.trim()}>{enviando ? 'Salvando...' : 'Adicionar anotação'}</button>
      </div>
      {erroEnvio && <p className="anotacoes__erro" role="alert">{erroEnvio}</p>}
      {mensagem && <p className="anotacoes__sucesso" role="status">{mensagem}</p>}
    </form>

    {lista.loading && !lista.data && <p role="status">Carregando anotações...</p>}
    {lista.error && <p className="anotacoes__erro" role="alert">{lista.error} <button type="button" onClick={lista.retry}>Tentar novamente</button></p>}
    {lista.data && (lista.data.data.length === 0
      ? <p className="anotacoes__vazio">Nenhuma anotação registrada.</p>
      : <ul className="anotacoes__lista" aria-busy={lista.loading}>
        {lista.data.data.map(nota => <li key={nota.id} className="anotacoes__item">
          <div className="anotacoes__autor"><strong>Usuário #{nota.autorId}</strong><small>{dataHora(nota.criadoEm)}</small></div>
          <p>{nota.texto}</p>
        </li>)}
      </ul>)}
    {lista.data && totalPaginas > 1 && <nav className="anotacoes__paginacao" aria-label="Paginação das anotações">
      <button type="button" disabled={pagina <= 1 || lista.loading} onClick={() => setPagina(p => p - 1)}>Anterior</button>
      <span aria-live="polite">Página {pagina} de {totalPaginas}</span>
      <button type="button" disabled={pagina >= totalPaginas || lista.loading} onClick={() => setPagina(p => p + 1)}>Próxima</button>
    </nav>}
  </div>;
}
