import { useEffect, useState } from 'react'
import {
  consultarDocumentos,
} from '../../shared/services/documentos.service'
import type {
  DocumentoGestao,
  FiltrosDocumentos,
  ListaDocumentos,
} from '../../shared/services/documentos.service'
import { DocumentoDetalhes } from './DocumentoDetalhes'
import { DocumentosFiltros } from './DocumentosFiltros'
import { DocumentosTabela } from './DocumentosTabela'
import {
  ABAS_DOCUMENTOS,
  filtrosDaAba,
  foiCancelamento,
  mensagemErroDocumentos,
} from './documentos.apresentacao'
import type { AbaDocumentos } from './documentos.apresentacao'

const ITENS_POR_PAGINA = 20

type SituacaoResumo = 'A_VENCER' | 'HOJE' | 'VENCIDO'
type Resumo = Record<SituacaoResumo, number>

export function Documentos() {
  const [lista, setLista] = useState<ListaDocumentos | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [erroResumo, setErroResumo] = useState<string | null>(null)
  const [aba, setAba] = useState<AbaDocumentos | null>('TODOS')
  const [filtros, setFiltros] = useState<FiltrosDocumentos>({})
  const [pagina, setPagina] = useState(1)
  const [atualizacao, setAtualizacao] = useState(0)
  const [selecionado, setSelecionado] = useState<DocumentoGestao | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setCarregando(true)
    setErro(null)

    consultarDocumentos(
      { ...filtros, page: pagina, limit: ITENS_POR_PAGINA },
      controller.signal,
    )
      .then(setLista)
      .catch((falha: unknown) => {
        if (!foiCancelamento(falha)) {
          setErro(mensagemErroDocumentos(falha))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [filtros, pagina, atualizacao])

  useEffect(() => {
    const controller = new AbortController()
    setErroResumo(null)

    const consultarTotal = (situacao: SituacaoResumo) =>
      consultarDocumentos(
        { situacao, page: 1, limit: 1 },
        controller.signal,
      ).then((resultado) => resultado.meta.total)

    Promise.all([
      consultarTotal('A_VENCER'),
      consultarTotal('HOJE'),
      consultarTotal('VENCIDO'),
    ])
      .then(([aVencer, hoje, vencidos]) => {
        setResumo({ A_VENCER: aVencer, HOJE: hoje, VENCIDO: vencidos })
      })
      .catch((falha: unknown) => {
        if (!foiCancelamento(falha)) {
          setResumo(null)
          setErroResumo('Não foi possível atualizar o resumo de vencimentos.')
        }
      })

    return () => controller.abort()
  }, [atualizacao])

  function mudarAba(novaAba: AbaDocumentos) {
    setAba(novaAba)
    setFiltros((atuais) => filtrosDaAba(novaAba, atuais))
    setPagina(1)
  }

  function aplicarFiltros(novosFiltros: FiltrosDocumentos) {
    setFiltros(novosFiltros)
    setAba(null)
    setPagina(1)
  }

  function limparFiltros() {
    setFiltros({})
    setAba('TODOS')
    setPagina(1)
  }

  function atualizarDados() {
    setAtualizacao((valor) => valor + 1)
  }

  const documentos = lista?.data ?? []
  const total = lista?.meta.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA))
  const haFiltros = Object.keys(filtros).length > 0

  return (
    <section className="docs">
      <header className="docs__topo">
        <h1>Documentos</h1>
        <p>Acompanhe a validade dos documentos da frota e dos motoristas.</p>
      </header>

      <div className="docs__cards" aria-label="Resumo de vencimentos">
        <CartaoResumo
          titulo="A vencer"
          valor={resumo?.A_VENCER}
          legenda="Validade futura"
          tom="a_vencer"
        />
        <CartaoResumo
          titulo="Vencem hoje"
          valor={resumo?.HOJE}
          legenda="Exigem atenção hoje"
          tom="hoje"
        />
        <CartaoResumo
          titulo="Vencidos"
          valor={resumo?.VENCIDO}
          legenda="Exigem regularização"
          tom="vencido"
        />
      </div>

      {erroResumo && (
        <div className="docs__resumo-erro" role="alert">
          <span>{erroResumo}</span>
          <button type="button" className="docs__botao" onClick={atualizarDados}>
            Tentar novamente
          </button>
        </div>
      )}

      <div className="docs__painel">
        <div className="docs__barra">
          <div className="docs__abas" role="tablist" aria-label="Filtrar documentos">
            {ABAS_DOCUMENTOS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={aba === item.id}
                className={
                  aba === item.id ? 'docs__aba docs__aba--ativa' : 'docs__aba'
                }
                onClick={() => mudarAba(item.id)}
              >
                {item.nome}
              </button>
            ))}
          </div>
          <span className="docs__total" aria-live="polite">
            {total} documento{total === 1 ? '' : 's'}
          </span>
        </div>

        <DocumentosFiltros
          valores={filtros}
          carregando={carregando}
          aoAplicar={aplicarFiltros}
          aoLimpar={limparFiltros}
        />

        {carregando ? (
          <p className="docs__estado" role="status">
            Carregando documentos…
          </p>
        ) : erro ? (
          <div className="docs__estado" role="alert">
            <p>{erro}</p>
            <button type="button" className="docs__botao" onClick={atualizarDados}>
              Tentar novamente
            </button>
          </div>
        ) : documentos.length === 0 ? (
          <p className="docs__estado">
            {haFiltros
              ? 'Nenhum documento corresponde aos filtros informados.'
              : 'Nenhum documento cadastrado.'}
          </p>
        ) : (
          <DocumentosTabela
            documentos={documentos}
            aoVisualizar={setSelecionado}
          />
        )}

        {!carregando && !erro && total > ITENS_POR_PAGINA && (
          <nav className="docs__paginacao" aria-label="Paginação de documentos">
            <button
              type="button"
              className="docs__botao"
              disabled={pagina === 1}
              onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
            >
              Anterior
            </button>
            <span>
              Página {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              className="docs__botao"
              disabled={pagina >= totalPaginas}
              onClick={() =>
                setPagina((atual) => Math.min(totalPaginas, atual + 1))
              }
            >
              Próxima
            </button>
          </nav>
        )}
      </div>

      {selecionado && (
        <DocumentoDetalhes
          key={`${selecionado.tipo}-${selecionado.id}`}
          inicial={selecionado}
          aoFechar={() => setSelecionado(null)}
          aoAlterar={atualizarDados}
        />
      )}
    </section>
  )
}

function CartaoResumo({
  titulo,
  valor,
  legenda,
  tom,
}: {
  titulo: string
  valor: number | undefined
  legenda: string
  tom: Lowercase<SituacaoResumo>
}) {
  return (
    <article className="docs__card">
      <div className="docs__card-topo">
        <span>{titulo}</span>
        <span
          className={`docs__card-icone docs__card-icone--${tom}`}
          aria-hidden="true"
        >
          {tom === 'vencido' ? '×' : '!'}
        </span>
      </div>
      <strong className="docs__card-valor">{valor ?? '—'}</strong>
      <small>{legenda}</small>
    </article>
  )
}
