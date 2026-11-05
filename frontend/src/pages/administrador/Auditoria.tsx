import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../../shared/components/Icone'
import { TabelaAuditoria } from '../../features/auditoria/TabelaAuditoria'
import { listarAtividades, type AtividadeAuditoria } from '../../shared/services/auditoria.service'
import './Auditoria.css'

const LIMITE = 20

const PERIODOS = [
  { valor: 'todos', rotulo: 'Todo o período', horas: Infinity },
  { valor: '24h', rotulo: 'Últimas 24 horas', horas: 24 },
  { valor: '3d', rotulo: 'Últimos 3 dias', horas: 72 },
  { valor: '7d', rotulo: 'Últimos 7 dias', horas: 168 },
]

const VAZIO = { busca: '', periodo: 'todos', usuario: '' }

const unicos = (lista: string[]) =>
  [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'))

export function Auditoria() {
  const [f, setF] = useState(VAZIO)
  const [pagina, setPagina] = useState(1)

  const [atividades, setAtividades] = useState<AtividadeAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const mudar = (campo: keyof typeof VAZIO, valor: string) => {
    setF((atual) => ({ ...atual, [campo]: valor }))
  }

  // Busca os registros da página atual no backend.
  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro('')

      try {
        const resposta = await listarAtividades(pagina, LIMITE)

        if (!ativo) return

        setAtividades(resposta.data)
        setTotal(resposta.meta.total)
      } catch (erro) {
        if (!ativo) return

        setAtividades([])
        setErro(
          erro instanceof Error
            ? erro.message
            : 'Não foi possível carregar os registros de auditoria.',
        )
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [pagina])

  // Os filtros abaixo são locais e atuam somente sobre a página carregada.
  const usuarios = useMemo(
    () => unicos(
      atividades
        .map((atividade) => atividade.usuarioNome)
        .filter((nome): nome is string => Boolean(nome)),
    ),
    [atividades],
  )

  const filtrados = useMemo(() => {
    const termo = f.busca.trim().toLowerCase()
    const horas = PERIODOS.find((p) => p.valor === f.periodo)?.horas ?? Infinity
    const limiteData = Date.now() - horas * 3600_000

    return atividades.filter((atividade) => {
      const data = atividade.dataHora
        ? new Date(atividade.dataHora).getTime()
        : null

      const dentroPeriodo =
        horas === Infinity || (data !== null && data >= limiteData)

      const usuarioCorresponde =
        !f.usuario || atividade.usuarioNome === f.usuario

      const buscaCorresponde =
        !termo ||
        [
          atividade.usuarioNome ?? '',
          atividade.descricao,
        ].some((texto) => texto.toLowerCase().includes(termo))

      return dentroPeriodo && usuarioCorresponde && buscaCorresponde
    })
  }, [atividades, f])

  const filtrosAtivos = JSON.stringify(f) !== JSON.stringify(VAZIO)

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))
  const de = total > 0 ? (pagina - 1) * LIMITE + 1 : 0
  const ate = Math.min(pagina * LIMITE, total)

  const resumo = [
    {
      rotulo: 'Eventos registrados',
      valor: total,
      classe: '',
    },
    {
      rotulo: 'Eventos nesta página',
      valor: atividades.length,
      classe: '',
    },
    {
      rotulo: 'Usuários nesta página',
      valor: usuarios.length,
      classe: '',
    },
    {
      rotulo: 'Resultados dos filtros',
      valor: filtrados.length,
      classe: '',
    },
  ]

  function limparFiltros() {
    setF(VAZIO)
  }

  return (
    <div className="auditoria">
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Auditoria</h1>
          <p className="pagina__descricao">
            Consulte os registros de acessos e ações realizadas no sistema.
          </p>
        </div>
      </div>

      <ul className="auditoria__kpis">
        {resumo.map((r) => (
          <li key={r.rotulo} className={`auditoria__kpi cartao ${r.classe}`}>
            <span>{r.rotulo}</span>
            <strong>{r.valor}</strong>
          </li>
        ))}
      </ul>

      <form
        className="auditoria__filtros cartao"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <div className="campo auditoria__busca">
          <label htmlFor="aud-busca">Buscar</label>
          <div className="auditoria__busca-entrada">
            <Icone nome="busca" tamanho={18} />
            <input
              id="aud-busca"
              type="search"
              placeholder="Usuário ou descrição da atividade"
              value={f.busca}
              onChange={(e) => mudar('busca', e.target.value)}
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="aud-periodo">Período</label>
          <select
            id="aud-periodo"
            value={f.periodo}
            onChange={(e) => mudar('periodo', e.target.value)}
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="aud-usuario">Usuário</label>
          <select
            id="aud-usuario"
            value={f.usuario}
            onChange={(e) => mudar('usuario', e.target.value)}
          >
            <option value="">Todos</option>
            {usuarios.map((usuario) => (
              <option key={usuario} value={usuario}>
                {usuario}
              </option>
            ))}
          </select>
        </div>

        {filtrosAtivos && (
          <button
            type="button"
            className="btn btn--secundario auditoria__limpar"
            onClick={limparFiltros}
          >
            Limpar
          </button>
        )}
      </form>

      {erro && (
        <div className="vazio" role="alert">
          <strong>Não foi possível carregar a auditoria</strong>
          {erro}
        </div>
      )}

      <TabelaAuditoria
        atividades={filtrados}
        carregando={carregando}
        filtrosAtivos={filtrosAtivos}
        aoLimpar={limparFiltros}
        pagina={pagina}
        totalPaginas={totalPaginas}
        de={de}
        ate={ate}
        total={total}
        aoMudarPagina={setPagina}
      />
    </div>
  )
}