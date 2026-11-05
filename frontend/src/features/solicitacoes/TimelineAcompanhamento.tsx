import { Icone } from '../../shared/components/Icone'
import { ETAPAS, etapaAlcancada, fluxoInterrompido } from './regras'
import type { Solicitacao } from './regras'
import { StatusSolicitacao } from './StatusSolicitacao'
import { formatarData } from './regras'
import './TimelineAcompanhamento.css'

export function TimelineAcompanhamento({ solicitacao: s }: { solicitacao: Solicitacao }) {
  const alcancada = etapaAlcancada(s.status)
  const interrompido = fluxoInterrompido(s.status)

  return (
    <section className="cartao sol-cartao" aria-labelledby="timeline-titulo">
      <div className="sol-cartao__topo">
        <div>
          <h2 id="timeline-titulo">Acompanhamento do transporte</h2>
          <p>Andamento baseado no status registrado da solicitação.</p>
        </div>
        <StatusSolicitacao status={s.status} />
      </div>
      <div className="sol-cartao__corpo">
        <ol className="timeline">
          {ETAPAS.map((etapa, i) => {
            const feita = i < alcancada || (i === alcancada && s.status === 'Concluída')
            const atual = i === alcancada && !feita
            const classe = feita ? 'timeline__etapa--feita' : atual ? 'timeline__etapa--atual' : ''
            return (
              <li key={etapa} className={`timeline__etapa ${classe}`} aria-current={atual ? 'step' : undefined}>
                <span className="timeline__numero">{feita ? <Icone nome="check" tamanho={16} /> : i + 1}</span>
                <strong>{etapa}</strong>
                <small>
                  {i > alcancada
                    ? 'Aguardando'
                    : atual
                      ? interrompido
                        ? `Fluxo encerrado: ${s.status.toLowerCase()}`
                        : 'Etapa atual'
                      : 'Concluída'}
                </small>
              </li>
            )
          })}
        </ol>

        <dl className="timeline__recursos">
          <div>
            <dt>Motorista</dt>
            <dd>{s.motorista ?? 'Ainda não atribuído'}</dd>
          </div>
          <div>
            <dt>Veículo</dt>
            <dd>{s.veiculo ?? 'Ainda não atribuído'}</dd>
          </div>
          <div>
            <dt>Data e horário previstos</dt>
            <dd>
              {formatarData(s.data)} · {s.horario}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
