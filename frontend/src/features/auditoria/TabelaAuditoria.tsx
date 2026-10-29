import { Paginacao, usePaginacao } from '../../shared/components/Paginacao'
import type { EventoAuditoria, Resultado, TipoEvento } from './dados'
import './TabelaAuditoria.css'

const corResultado: Record<Resultado, string> = {
  Sucesso: 'badge--verde',
  Falha: 'badge--vermelho',
  Negado: 'badge--amarelo',
}
const corEvento: Partial<Record<TipoEvento, string>> = {
  Login: 'badge--azul',
  Logout: 'badge--cinza',
  'Tentativa de acesso': 'badge--vermelho',
  'Alteração de permissões': 'badge--amarelo',
  'Desativação de conta': 'badge--vermelho',
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

type Props = { eventos: EventoAuditoria[]; filtrosAtivos: boolean; aoLimpar: () => void }

export function TabelaAuditoria({ eventos, filtrosAtivos, aoLimpar }: Props) {
  const pag = usePaginacao(eventos, 10)

  return (
    <section className="tab-auditoria cartao" aria-label="Eventos de auditoria">
      <div className="tab-auditoria__rolagem">
        <table className="tab-auditoria__tabela">
          <thead>
            <tr>
              <th scope="col">Data e hora</th>
              <th scope="col">Usuário</th>
              <th scope="col">Perfil</th>
              <th scope="col">Evento</th>
              <th scope="col">Módulo</th>
              <th scope="col">Resultado</th>
              <th scope="col">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {pag.visiveis.map((e) => {
              const d = new Date(e.dataHora)
              return (
                <tr key={e.id}>
                  <td>
                    <time dateTime={e.dataHora} className="tab-auditoria__data">
                      <strong>{fmtData.format(d)}</strong>
                      <small>{fmtHora.format(d)}</small>
                    </time>
                  </td>
                  <td className="tab-auditoria__usuario">{e.usuario}</td>
                  <td className="tab-auditoria__suave">{e.perfil}</td>
                  <td>
                    <span className={`badge ${corEvento[e.evento] ?? 'badge--marinho'}`}>{e.evento}</span>
                  </td>
                  <td className="tab-auditoria__suave">{e.modulo}</td>
                  <td>
                    <span className={`badge ${corResultado[e.resultado]}`}>{e.resultado}</span>
                  </td>
                  <td className="tab-auditoria__detalhes">{e.detalhes}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!eventos.length && (
          <div className="vazio">
            {filtrosAtivos ? (
              <>
                <strong>Nenhum evento corresponde aos filtros</strong>
                <button type="button" className="btn btn--secundario tab-auditoria__limpar" onClick={aoLimpar}>
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <strong>Nenhum evento registrado</strong>
                Os eventos aparecerão aqui assim que forem gerados.
              </>
            )}
          </div>
        )}
      </div>
      <Paginacao {...pag} rotulo="eventos" aoMudar={pag.setPagina} />
    </section>
  )
}
