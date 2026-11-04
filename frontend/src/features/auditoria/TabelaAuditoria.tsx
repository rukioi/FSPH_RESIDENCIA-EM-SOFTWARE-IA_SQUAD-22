import { Paginacao } from '../../shared/components/Paginacao'
import type { AtividadeAuditoria } from '../../shared/services/auditoria.service'
import './TabelaAuditoria.css'

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

type Props = {
  atividades: AtividadeAuditoria[]
  carregando: boolean
  filtrosAtivos: boolean
  aoLimpar: () => void
  pagina: number
  totalPaginas: number
  de: number
  ate: number
  total: number
  aoMudarPagina: (pagina: number) => void
}

export function TabelaAuditoria({
  atividades,
  carregando,
  filtrosAtivos,
  aoLimpar,
  pagina,
  totalPaginas,
  de,
  ate,
  total,
  aoMudarPagina,
}: Props) {
  return (
    <section className="tab-auditoria cartao" aria-label="Eventos de auditoria">
      <div className="tab-auditoria__rolagem">
        <table className="tab-auditoria__tabela">
          <thead>
            <tr>
              <th scope="col">Data e hora</th>
              <th scope="col">Usuário</th>
              <th scope="col">Atividade</th>
            </tr>
          </thead>

          <tbody>
            {!carregando &&
              atividades.map((atividade) => {
                const data = atividade.dataHora
                  ? new Date(atividade.dataHora)
                  : null

                const dataValida =
                  data !== null && !Number.isNaN(data.getTime())

                return (
                  <tr key={atividade.id}>
                    <td>
                      {dataValida ? (
                        <time
                          dateTime={atividade.dataHora ?? undefined}
                          className="tab-auditoria__data"
                        >
                          <strong>{fmtData.format(data)}</strong>
                          <small>{fmtHora.format(data)}</small>
                        </time>
                      ) : (
                        <span className="tab-auditoria__suave">
                          Data não disponível
                        </span>
                      )}
                    </td>

                    <td className="tab-auditoria__usuario">
                      {atividade.usuarioNome ?? 'Usuário não identificado'}
                    </td>

                    <td className="tab-auditoria__detalhes">
                      {atividade.descricao}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>

        {carregando && (
          <div className="vazio">
            Carregando registros de auditoria...
          </div>
        )}

        {!carregando && !atividades.length && (
          <div className="vazio">
            {filtrosAtivos ? (
              <>
                <strong>Nenhum evento corresponde aos filtros</strong>
                <button
                  type="button"
                  className="btn btn--secundario tab-auditoria__limpar"
                  onClick={aoLimpar}
                >
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

      <Paginacao
        pagina={pagina}
        totalPaginas={totalPaginas}
        de={de}
        ate={ate}
        total={total}
        rotulo="eventos"
        aoMudar={aoMudarPagina}
      />
    </section>
  )
}