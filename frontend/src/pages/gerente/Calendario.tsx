import { useMemo, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { listarSolicitacoes } from '../../features/solicitacoes/dados'
import { formatarData } from '../../features/solicitacoes/regras'
import type { Solicitacao } from '../../features/solicitacoes/regras'
import { StatusSolicitacao } from '../../features/solicitacoes/StatusSolicitacao'
import './Calendario.css'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

// Demonstração: abre no dia com mais registros dos dados de exemplo.
function diaInicial(lista: Solicitacao[]) {
  const contagem = new Map<string, number>()
  lista.forEach((s) => contagem.set(s.data, (contagem.get(s.data) ?? 0) + 1))
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? iso(new Date())
}

export function Calendario() {
  const todas = listarSolicitacoes()
  const porDia = useMemo(() => {
    const mapa = new Map<string, Solicitacao[]>()
    todas.forEach((s) => mapa.set(s.data, [...(mapa.get(s.data) ?? []), s]))
    mapa.forEach((l) => l.sort((a, b) => a.horario.localeCompare(b.horario)))
    return mapa
  }, [todas])

  const [selecionado, setSelecionado] = useState(() => diaInicial(todas))
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes')
  const ref = deIso(selecionado)

  // Dias exibidos (null = célula vazia antes do dia 1)
  const dias: (Date | null)[] = useMemo(() => {
    const ref = deIso(selecionado)
    if (visao === 'semana') {
      const inicio = somarDias(ref, -ref.getDay())
      return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
    }
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const total = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
    return [
      ...Array.from({ length: primeiro.getDay() }, () => null),
      ...Array.from({ length: total }, (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1)),
    ]
  }, [visao, selecionado])

  function mover(direcao: 1 | -1) {
    if (visao === 'semana') setSelecionado(iso(somarDias(ref, 7 * direcao)))
    else setSelecionado(iso(new Date(ref.getFullYear(), ref.getMonth() + direcao, 1)))
  }

  const titulo =
    visao === 'mes'
      ? `${MESES[ref.getMonth()]} ${ref.getFullYear()}`
      : `${formatarData(iso(dias[0] as Date))} – ${formatarData(iso(dias[6] as Date))}`
  const itensDoDia = porDia.get(selecionado) ?? []
  const hoje = iso(new Date())

  return (
    <>
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Calendário</h1>
          <p className="pagina__descricao">Consulte a programação diária de chamados e viagens.</p>
        </div>
      </div>

      <div className="cal">
        <section className="cartao cal__principal" aria-label="Calendário de solicitações">
          <div className="cal__topo">
            <h2 aria-live="polite">{titulo}</h2>
            <div className="cal__controles">
              <div className="cal__visao" role="group" aria-label="Visualização">
                <button type="button" aria-pressed={visao === 'mes'} onClick={() => setVisao('mes')}>
                  Mês
                </button>
                <button type="button" aria-pressed={visao === 'semana'} onClick={() => setVisao('semana')}>
                  Semana
                </button>
              </div>
              <button type="button" className="cal__seta cal__seta--anterior" aria-label={visao === 'mes' ? 'Mês anterior' : 'Semana anterior'} onClick={() => mover(-1)}>
                <Icone nome="seta" tamanho={18} />
              </button>
              <button type="button" className="cal__seta cal__seta--proxima" aria-label={visao === 'mes' ? 'Próximo mês' : 'Próxima semana'} onClick={() => mover(1)}>
                <Icone nome="seta" tamanho={18} />
              </button>
            </div>
          </div>

          <div className={visao === 'semana' ? 'cal__grade cal__grade--semana' : 'cal__grade'}>
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="cal__dia-semana">
                {d}
              </span>
            ))}
            {dias.map((d, i) => {
              if (!d) return <span key={`v${i}`} aria-hidden="true" />
              const chave = iso(d)
              const qtd = porDia.get(chave)?.length ?? 0
              const classes = ['cal__dia']
              if (chave === selecionado) classes.push('cal__dia--selecionado')
              else if (qtd) classes.push('cal__dia--com-itens')
              if (chave === hoje) classes.push('cal__dia--hoje')
              return (
                <button
                  key={chave}
                  type="button"
                  className={classes.join(' ')}
                  aria-pressed={chave === selecionado}
                  aria-label={`${formatarData(chave)}: ${qtd ? `${qtd} ${qtd === 1 ? 'item' : 'itens'}` : 'sem registros'}`}
                  onClick={() => setSelecionado(chave)}
                >
                  <span>{d.getDate()}</span>
                  {qtd > 0 && <small>{qtd === 1 ? '1 item' : `${qtd} itens`}</small>}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="cartao cal__painel" aria-labelledby="cal-dia">
          <div className="cal__painel-topo">
            <h2 id="cal-dia">{formatarData(selecionado)}</h2>
            <p>
              {itensDoDia.length === 0
                ? 'Nenhum chamado/viagem'
                : `${itensDoDia.length} ${itensDoDia.length === 1 ? 'chamado/viagem' : 'chamados/viagens'}`}
            </p>
          </div>

          {itensDoDia.length === 0 ? (
            <div className="vazio">
              <strong>Sem registros neste dia</strong>
              <p>Selecione um dia destacado no calendário.</p>
            </div>
          ) : (
            <ul className="cal__lista">
              {itensDoDia.map((s) => (
                <li key={s.id}>
                  <button type="button" className="cal__item" onClick={() => navegar(rotaSolicitacao(ROTAS.solicitacoesGestor, s.id))}>
                    <span className="cal__item-topo">
                      <strong>
                        {s.horario} · #{s.id}
                      </strong>
                      <StatusSolicitacao status={s.status} />
                    </span>
                    <small>{s.instituicao}</small>
                    <span className="cal__rota">
                      {s.origem} → {s.destino}
                    </span>
                    <span className="cal__recursos">
                      <span>
                        <small>Motorista</small>
                        {s.motorista ?? 'Não atribuído'}
                      </span>
                      <span>
                        <small>Veículo</small>
                        {s.veiculo ?? 'Não atribuído'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
