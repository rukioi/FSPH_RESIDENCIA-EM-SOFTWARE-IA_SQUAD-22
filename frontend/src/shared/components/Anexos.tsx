
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  baixarAnexo,
  enviarAnexo,
  listarAnexos,
  type Anexo,
  type TipoRegistroAnexo,
} from '../services/anexos.service';

import { errorMessage } from '../api/errors';
import './Anexos.css';

type AnexosProps = {
  tipoRegistro: TipoRegistroAnexo;
  registroId: string;
};

const LIMITE_POR_PAGINA = 20;

export function Anexos({ tipoRegistro, registroId }: AnexosProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(LIMITE_POR_PAGINA);
  const [total, setTotal] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const vinculoAnterior = useRef({ tipoRegistro, registroId });

  const totalPaginas = Math.ceil(total / limite);

  const carregarAnexos = useCallback(async (paginaSolicitada = pagina) => {
    setCarregando(true);
    setErro('');

    try {
      const resposta = await listarAnexos({
        tipoRegistro,
        registroId,
        page: paginaSolicitada,
        limit: LIMITE_POR_PAGINA,
      });

      setAnexos(resposta.data);
      setPagina(resposta.meta.page);
      setLimite(resposta.meta.limit);
      setTotal(resposta.meta.total);
    } catch (error) {
      setErro(errorMessage(error));
    } finally {
      setCarregando(false);
    }
  }, [tipoRegistro, registroId, pagina]);

  useEffect(() => {
    const vinculoMudou =
      vinculoAnterior.current.tipoRegistro !== tipoRegistro ||
      vinculoAnterior.current.registroId !== registroId;

    if (vinculoMudou) {
      vinculoAnterior.current = { tipoRegistro, registroId };

      setPagina(1);
      setAnexos([]);
      setTotal(0);
      setArquivo(null);
      setMensagem('');

      if (pagina !== 1) {
        return;
      }
    }

    void carregarAnexos(vinculoMudou ? 1 : pagina);
  }, [tipoRegistro, registroId, pagina, carregarAnexos]);

  async function handleEnviar() {
    if (!arquivo) {
      setErro('Selecione um arquivo antes de enviar.');
      return;
    }

    setEnviando(true);
    setErro('');
    setMensagem('');

    try {
      await enviarAnexo(
        { tipoRegistro, registroId },
        arquivo,
      );

      setArquivo(null);
      setMensagem('Arquivo enviado com sucesso.');

      await carregarAnexos(pagina);
    } catch (error) {
      setErro(errorMessage(error));
    } finally {
      setEnviando(false);
    }
  }

  async function handleBaixar(anexo: Anexo) {
    setBaixandoId(anexo.id);
    setErro('');

    try {
      const blob = await baixarAnexo(anexo.id);
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = anexo.nome;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(errorMessage(error));
    } finally {
      setBaixandoId(null);
    }
  }

  function formatarTamanho(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatarData(data: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(data));
  }

  function irParaPaginaAnterior() {
    if (pagina > 1) {
      setPagina(pagina - 1);
    }
  }

  function irParaProximaPagina() {
    if (pagina < totalPaginas) {
      setPagina(pagina + 1);
    }
  }

  return (
    <section className="anexos">
      <div className="anexos__cabecalho">
        <div>
          <h2>Documentos e anexos</h2>
          <p>Arquivos vinculados a este registro.</p>
        </div>
      </div>

      <div className="anexos__upload">
        <label htmlFor="anexo-arquivo">
          Selecionar arquivo
        </label>

        <input
          id="anexo-arquivo"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={enviando}
          onChange={event => {
            setArquivo(event.target.files?.[0] ?? null);
            setErro('');
            setMensagem('');
          }}
        />

        {arquivo && (
          <p className="anexos__arquivo-selecionado">
            {arquivo.name}
          </p>
        )}

        <small>Formatos aceitos: PDF, JPG e PNG. Limite: 5 MiB.</small>

        <button
          type="button"
          onClick={handleEnviar}
          disabled={!arquivo || enviando}
        >
          {enviando ? 'Enviando...' : 'Enviar arquivo'}
        </button>
      </div>

      {erro && (
        <p className="anexos__erro" role="alert">
          {erro}
        </p>
      )}

      {mensagem && (
        <p className="anexos__sucesso" role="status">
          {mensagem}
        </p>
      )}

      <div className="anexos__lista">
        <h3>Arquivos enviados</h3>

        {carregando ? (
            <p>Carregando anexos...</p>
            ) : erro ? (
            <button
                type="button"
                onClick={() => void carregarAnexos(pagina)}
            >
                Tentar novamente
            </button>
            ) : anexos.length === 0 ? (
            <p>Nenhum arquivo anexado a este registro.</p>
            ) : (
          <>
            <ul>
              {anexos.map(anexo => (
                <li key={anexo.id} className="anexos__item">
                  <div className="anexos__informacoes">
                    <strong>{anexo.nome}</strong>
                    <span>{anexo.tipo}</span>
                    <span>{formatarTamanho(anexo.tamanho)}</span>
                    <span>{formatarData(anexo.criadoEm)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBaixar(anexo)}
                    disabled={baixandoId === anexo.id}
                  >
                    {baixandoId === anexo.id ? 'Baixando...' : 'Baixar'}
                  </button>
                </li>
              ))}
            </ul>

            {totalPaginas > 1 && (
              <nav
                className="anexos__paginacao"
                aria-label="Paginação dos anexos"
              >
                <button
                  type="button"
                  onClick={irParaPaginaAnterior}
                  disabled={pagina <= 1 || carregando}
                  aria-label="Ir para a página anterior"
                >
                  Página anterior
                </button>

                <span aria-live="polite">
                  Página {pagina} de {totalPaginas}
                </span>

                <button
                  type="button"
                  onClick={irParaProximaPagina}
                  disabled={pagina >= totalPaginas || carregando}
                  aria-label="Ir para a próxima página"
                >
                  Próxima página
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
