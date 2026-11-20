import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  buscarDetalheDocumento,
  buscarHistoricoDocumento,
  editarDocumento,
} from '../../shared/services/documentos.service'
import type {
  DadosEdicaoDocumento,
  DocumentoGestao,
  HistoricoDocumento,
} from '../../shared/services/documentos.service'
import {
  dataBr,
  dataHoraBr,
  descricaoDias,
  foiCancelamento,
  mensagemErroDocumentos,
  nomeDocumento,
  relacionadoDocumento,
  ROTULO_SITUACAO,
  situacaoDocumento,
} from './documentos.apresentacao'

const CATEGORIAS = ['A', 'B', 'C', 'D', 'E'] as const
const HISTORICO_POR_PAGINA = 20

type Props = {
  inicial: Pick<DocumentoGestao, 'id' | 'tipo'>
  aoFechar: () => void
  aoAlterar: () => void
}

export function DocumentoDetalhes({ inicial, aoFechar, aoAlterar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [documento, setDocumento] = useState<DocumentoGestao | null>(null)
  const [historico, setHistorico] = useState<HistoricoDocumento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [erroHistorico, setErroHistorico] = useState<string | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [tentativaHistorico, setTentativaHistorico] = useState(0)
  const [paginaHistorico, setPaginaHistorico] = useState(1)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setCarregando(true)
    setErro(null)

    buscarDetalheDocumento(inicial.id, inicial.tipo, controller.signal)
      .then((resposta) => setDocumento(resposta.data))
      .catch((falha: unknown) => {
        if (!foiCancelamento(falha)) {
          setErro(
            mensagemErroDocumentos(
              falha,
              'Não foi possível carregar os detalhes do documento.',
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [inicial.id, inicial.tipo, tentativa])

  useEffect(() => {
    const controller = new AbortController()
    setCarregandoHistorico(true)
    setErroHistorico(null)

    buscarHistoricoDocumento(
      inicial.id,
      inicial.tipo,
      paginaHistorico,
      HISTORICO_POR_PAGINA,
      controller.signal,
    )
      .then(setHistorico)
      .catch((falha: unknown) => {
        if (!foiCancelamento(falha)) {
          setErroHistorico(
            mensagemErroDocumentos(
              falha,
              'Não foi possível carregar o histórico do documento.',
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoHistorico(false)
      })

    return () => controller.abort()
  }, [inicial.id, inicial.tipo, paginaHistorico, tentativaHistorico])

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!documento || salvando) return

    const campos = new FormData(evento.currentTarget)
    const cnh = documento.tipo === 'CNH_MOTORISTA'
    const dados: DadosEdicaoDocumento = {
      versao: documento.versao,
      dataValidade: String(campos.get('dataValidade')),
      ...(cnh
        ? {
            numeroCnh: String(campos.get('numeroCnh')).trim(),
            categoriaCnh: String(
              campos.get('categoriaCnh'),
            ) as NonNullable<DadosEdicaoDocumento['categoriaCnh']>,
          }
        : { tipoDocumento: String(campos.get('tipoDocumento')).trim() }),
    }

    setSalvando(true)
    setErroEdicao(null)
    setSucesso(null)
    try {
      const resposta = await editarDocumento(documento.id, documento.tipo, dados)
      setDocumento(resposta.data)
      setEditando(false)
      setSucesso('Documento atualizado com sucesso.')
      setPaginaHistorico(1)
      setTentativaHistorico((valor) => valor + 1)
      aoAlterar()
    } catch (falha) {
      setErroEdicao(
        mensagemErroDocumentos(
          falha,
          'Não foi possível salvar as alterações. Tente novamente.',
        ),
      )
    } finally {
      setSalvando(false)
    }
  }

  function recarregarDepoisDoConflito() {
    setEditando(false)
    setErroEdicao(null)
    setSucesso(null)
    setTentativa((valor) => valor + 1)
    setTentativaHistorico((valor) => valor + 1)
  }

  const situacao = documento ? situacaoDocumento(documento) : null
  const totalPaginasHistorico = Math.max(
    1,
    Math.ceil((historico?.meta.total ?? 0) / HISTORICO_POR_PAGINA),
  )

  return (
    <dialog
      ref={ref}
      className="docs-modal"
      aria-labelledby="docs-modal-titulo"
      onClose={aoFechar}
    >
      <header className="docs-modal__topo">
        <div>
          <h2 id="docs-modal-titulo">
            {documento ? nomeDocumento(documento) : 'Detalhes do documento'}
          </h2>
          <p className="docs__suave">
            {documento
              ? `${relacionadoDocumento(documento)} · versão ${documento.versao}`
              : `Registro #${inicial.id}`}
          </p>
        </div>
        {situacao && (
          <span className={`docs__selo docs__selo--${situacao.toLowerCase()}`}>
            {ROTULO_SITUACAO[situacao]}
          </span>
        )}
      </header>

      {sucesso && (
        <p className="docs-modal__sucesso" role="status">
          {sucesso}
        </p>
      )}

      {carregando ? (
        <p className="docs__suave" role="status">
          Carregando detalhes…
        </p>
      ) : erro ? (
        <div className="docs-modal__erro" role="alert">
          <p>{erro}</p>
          <button
            type="button"
            className="docs__botao"
            onClick={() => setTentativa((valor) => valor + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : documento ? (
        <>
          {erroEdicao && (
            <div className="docs-modal__erro" role="alert">
              <p>{erroEdicao}</p>
              <button
                type="button"
                className="docs__botao"
                onClick={recarregarDepoisDoConflito}
              >
                Atualizar detalhes
              </button>
            </div>
          )}

          {editando ? (
            <form
              key={documento.versao}
              className="docs-modal__form"
              onSubmit={salvar}
            >
              {documento.tipo === 'CNH_MOTORISTA' ? (
                <>
                  <label>
                    Número da CNH
                    <input
                      name="numeroCnh"
                      defaultValue={documento.numeroCnh ?? ''}
                      required
                      maxLength={20}
                    />
                  </label>
                  <label>
                    Categoria
                    <select
                      name="categoriaCnh"
                      defaultValue={documento.categoriaCnh ?? 'B'}
                      required
                    >
                      {CATEGORIAS.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label>
                  Tipo do documento
                  <input
                    name="tipoDocumento"
                    defaultValue={documento.tipoDocumento ?? ''}
                    required
                    maxLength={50}
                  />
                </label>
              )}
              <label>
                Validade
                <input
                  type="date"
                  name="dataValidade"
                  defaultValue={documento.dataValidade}
                  required
                />
              </label>
              <div className="docs-modal__acoes">
                <button
                  type="button"
                  className="docs__botao"
                  onClick={() => setEditando(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="docs__botao docs__botao--primario"
                  disabled={salvando}
                >
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="docs-modal__dados">
              {documento.tipo === 'CNH_MOTORISTA' ? (
                <>
                  <div>
                    <dt>Número da CNH</dt>
                    <dd>{documento.numeroCnh ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Categoria</dt>
                    <dd>{documento.categoriaCnh ?? '—'}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt>Tipo do documento</dt>
                  <dd>{documento.tipoDocumento ?? '—'}</dd>
                </div>
              )}
              <div>
                <dt>Validade</dt>
                <dd>{dataBr(documento.dataValidade)}</dd>
              </div>
              <div>
                <dt>Prazo informado pelo servidor</dt>
                <dd>{descricaoDias(documento.diasRestantes)}</dd>
              </div>
            </dl>
          )}
        </>
      ) : null}

      <section className="docs-modal__historico-area" aria-labelledby="docs-historico-titulo">
        <h3 id="docs-historico-titulo" className="docs-modal__subtitulo">
          Histórico de versões
        </h3>
        {carregandoHistorico ? (
          <p className="docs__suave" role="status">
            Carregando histórico…
          </p>
        ) : erroHistorico ? (
          <div className="docs-modal__erro" role="alert">
            <p>{erroHistorico}</p>
            <button
              type="button"
              className="docs__botao"
              onClick={() => setTentativaHistorico((valor) => valor + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : !historico || historico.data.length === 0 ? (
          <p className="docs__suave">Sem alterações registradas.</p>
        ) : (
          <>
            <ol className="docs-modal__historico">
              {historico.data.map((versao) => (
                <li key={versao.id}>
                  <strong>
                    Versão {versao.versao} · validade {dataBr(versao.dataValidade)}
                  </strong>
                  <span>
                    {inicial.tipo === 'CNH_MOTORISTA'
                      ? `CNH ${versao.categoriaCnh ?? ''} · ${versao.numeroCnh ?? '—'}`
                      : versao.tipoDocumento ?? 'Documento do veículo'}
                  </span>
                  <small className="docs__suave">
                    {dataHoraBr(versao.criadoEm)} · usuário #{versao.autorId}
                  </small>
                </li>
              ))}
            </ol>
            {historico.meta.total > HISTORICO_POR_PAGINA && (
              <nav className="docs__paginacao" aria-label="Paginação do histórico">
                <button
                  type="button"
                  className="docs__botao"
                  disabled={paginaHistorico === 1}
                  onClick={() =>
                    setPaginaHistorico((atual) => Math.max(1, atual - 1))
                  }
                >
                  Anterior
                </button>
                <span>
                  Página {paginaHistorico} de {totalPaginasHistorico}
                </span>
                <button
                  type="button"
                  className="docs__botao"
                  disabled={paginaHistorico >= totalPaginasHistorico}
                  onClick={() =>
                    setPaginaHistorico((atual) =>
                      Math.min(totalPaginasHistorico, atual + 1),
                    )
                  }
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      <div className="docs-modal__acoes">
        {!editando && documento && !erro && (
          <button
            type="button"
            className="docs__botao"
            onClick={() => {
              setErroEdicao(null)
              setSucesso(null)
              setEditando(true)
            }}
          >
            Editar
          </button>
        )}
        <button
          type="button"
          className="docs__botao docs__botao--primario"
          onClick={() => ref.current?.close()}
          disabled={salvando}
        >
          Fechar
        </button>
      </div>
    </dialog>
  )
}
