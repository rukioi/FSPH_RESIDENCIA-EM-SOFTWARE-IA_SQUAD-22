import { useMemo, useState } from 'react'
import { Icone } from '../../shared/components/Icone'
import { TabelaAuditoria } from '../../features/auditoria/TabelaAuditoria'
import { TIPOS_EVENTO, eventosAuditoria } from '../../features/auditoria/dados'
import './Auditoria.css'

const PERIODOS = [
  { valor: 'todos', rotulo: 'Todo o período', horas: Infinity },
  { valor: '24h', rotulo: 'Últimas 24 horas', horas: 24 },
  { valor: '3d', rotulo: 'Últimos 3 dias', horas: 72 },
  { valor: '7d', rotulo: 'Últimos 7 dias', horas: 168 },
]
const VAZIO = { busca: '', periodo: 'todos', usuario: '', perfil: '', evento: '' }

const unicos = (l: string[]) => [...new Set(l)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
const USUARIOS = unicos(eventosAuditoria.map((e) => e.usuario))
const PERFIS = unicos(eventosAuditoria.map((e) => e.perfil))

export function Auditoria() {
  const [f, setF] = useState(VAZIO)
  const mudar = (campo: keyof typeof VAZIO, valor: string) => setF((x) => ({ ...x, [campo]: valor }))

  const filtrados = useMemo(() => {
    const termo = f.busca.trim().toLowerCase()
    const horas = PERIODOS.find((p) => p.valor === f.periodo)?.horas ?? Infinity
    const limite = Date.now() - horas * 3600_000
    return eventosAuditoria.filter(
      (e) =>
        (horas === Infinity || new Date(e.dataHora).getTime() >= limite) &&
        (!f.usuario || e.usuario === f.usuario) &&
        (!f.perfil || e.perfil === f.perfil) &&
        (!f.evento || e.evento === f.evento) &&
        (!termo || [e.usuario, e.evento, e.modulo, e.detalhes].some((t) => t.toLowerCase().includes(termo))),
    )
  }, [f])

  const filtrosAtivos = JSON.stringify(f) !== JSON.stringify(VAZIO)
  const resumo = [
    { rotulo: 'Eventos no filtro', valor: filtrados.length, classe: '' },
    { rotulo: 'Sucesso', valor: filtrados.filter((e) => e.resultado === 'Sucesso').length, classe: 'auditoria__kpi--verde' },
    { rotulo: 'Falhas', valor: filtrados.filter((e) => e.resultado === 'Falha').length, classe: 'auditoria__kpi--vermelho' },
    { rotulo: 'Acessos negados', valor: filtrados.filter((e) => e.resultado === 'Negado').length, classe: 'auditoria__kpi--amarelo' },
  ]

  return (
    <div className="auditoria">
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Auditoria</h1>
          <p className="pagina__descricao">Consulte os registros de acessos e ações realizadas no sistema.</p>
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

      <form className="auditoria__filtros cartao" onSubmit={(e) => e.preventDefault()} role="search">
        <div className="campo auditoria__busca">
          <label htmlFor="aud-busca">Buscar</label>
          <div className="auditoria__busca-entrada">
            <Icone nome="busca" tamanho={18} />
            <input
              id="aud-busca"
              type="search"
              placeholder="Usuário, evento, módulo ou detalhe"
              value={f.busca}
              onChange={(e) => mudar('busca', e.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="aud-periodo">Período</label>
          <select id="aud-periodo" value={f.periodo} onChange={(e) => mudar('periodo', e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="aud-usuario">Usuário</label>
          <select id="aud-usuario" value={f.usuario} onChange={(e) => mudar('usuario', e.target.value)}>
            <option value="">Todos</option>
            {USUARIOS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="aud-perfil">Perfil</label>
          <select id="aud-perfil" value={f.perfil} onChange={(e) => mudar('perfil', e.target.value)}>
            <option value="">Todos</option>
            {PERFIS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="aud-evento">Tipo de evento</label>
          <select id="aud-evento" value={f.evento} onChange={(e) => mudar('evento', e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_EVENTO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {filtrosAtivos && (
          <button type="button" className="btn btn--secundario auditoria__limpar" onClick={() => setF(VAZIO)}>
            Limpar
          </button>
        )}
      </form>

      {/* key força voltar à página 1 quando os filtros mudam */}
      <TabelaAuditoria
        key={JSON.stringify(f)}
        eventos={filtrados}
        filtrosAtivos={filtrosAtivos}
        aoLimpar={() => setF(VAZIO)}
      />
    </div>
  )
}
