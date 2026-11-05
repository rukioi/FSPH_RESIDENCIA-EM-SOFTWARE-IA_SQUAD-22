
import { useEffect, useMemo, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS, rotaSolicitacao } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import { buscarAgenda } from '../../shared/services/solicitacoes.service'
import { formatarData } from '../../features/solicitacoes/regras'
import type { Solicitacao } from '../../features/solicitacoes/regras'
import { StatusSolicitacao } from '../../features/solicitacoes/StatusSolicitacao'
import './Calendario.css'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

const somarDias = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

type ItemAgenda = Awaited<ReturnType<typeof buscarAgenda>>['data'][number]

function mapearAgendamento(item: ItemAgenda): Solicitacao {
  const dataSaida = new Date(item.dataHoraSaida)

  return {
    id: String(item.id),
    solicitante: '—',
    instituicao: '—',
    data: iso(dataSaida),
    horario: dataSaida.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    origem: item.origem,
    destino: item.destino,
    passageiros: item.qtdPassageiros ?? 0,
    finalidade: item.finalidade ?? '',
    observacao: '',
    documentos: '',
    status: 'Agendada',
    criadaEm: '',
    motorista: item.motorista?.nome ?? 'Não atribuído',
    veiculo: item.veiculo
      ? `${item.veiculo.placa} - ${item.veiculo.modelo}`
      : 'Não atribuído',
    comentarios: [],
  }
}

export function Calendario() {
  const [todas, setTodas] = useState<Solicitacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [selecionado, setSelecionado] = useState(() => iso(new Date()))
  const [visao, setVisao] = useState<'mes' | 'semana'>('mes')

  const ref = deIso(selecionado)

  // Define o intervalo que será consultado na API.
  const intervalo = useMemo(() => {
    const referencia = deIso(selecionado)

    if (visao === 'semana') {
      const inicio = somarDias(referencia, -referencia.getDay())
      const fim = somarDias(inicio, 6)

      return {
        inicio: `${iso(inicio)}T00:00:00-03:00`,
        fim: `${iso(fim)}T23:59:59.999999-03:00`,
      }
    }

    const inicio = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      1,
    )

    const fim = new Date(
      referencia.getFullYear(),
      referencia.getMonth() + 1,
      0,
    )

    return {
      inicio: `${iso(inicio)}T00:00:00-03:00`,
      fim: `${iso(fim)}T23:59:59.999999-03:00`,
    }
  }, [selecionado, visao])

  // Busca os agendamentos do período selecionado.
  useEffect(() => {
    let ativo = true

    async function carregarAgendamentos() {
      setCarregando(true)
      setErro('')

      try {
        const primeiraPagina = await buscarAgenda({
          inicio: intervalo.inicio,
          fim: intervalo.fim,
          page: 1,
          limit: 100,
        })

        const totalPaginas = Math.ceil(
          primeiraPagina.meta.total / primeiraPagina.meta.limit,
        )

        const outrasPaginas = await Promise.all(
          Array.from(
            { length: Math.max(0, totalPaginas - 1) },
            (_, indice) =>
              buscarAgenda({
                inicio: intervalo.inicio,
                fim: intervalo.fim,
                page: indice + 2,
                limit: 100,
              }),
          ),
        )

        const agendamentos = [
          ...primeiraPagina.data,
          ...outrasPaginas.flatMap((pagina) => pagina.data),
        ]

        if (ativo) {
          setTodas(agendamentos.map(mapearAgendamento))
        }
      } catch (erroApi) {
        if (ativo) {
          setTodas([])
          setErro(
            erroApi instanceof Error
              ? erroApi.message
              : 'Não foi possível carregar os agendamentos.',
          )
        }
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }

    void carregarAgendamentos()

    return () => {
      ativo = false
    }
  }, [intervalo])

  const porDia = useMemo(() => {
    const mapa = new Map<string, Solicitacao[]>()

    todas.forEach((solicitacao) => {
      mapa.set(solicitacao.data, [
        ...(mapa.get(solicitacao.data) ?? []),
        solicitacao,
      ])
    })

    mapa.forEach((lista) =>
      lista.sort((a, b) => a.horario.localeCompare(b.horario)),
    )

    return mapa
  }, [todas])

  // Dias exibidos (null = célula vazia antes do dia 1).
  const dias: (Date | null)[] = useMemo(() => {
    const referencia = deIso(selecionado)

    if (visao === 'semana') {
      const inicio = somarDias(referencia, -referencia.getDay())

      return Array.from(
        { length: 7 },
        (_, i) => somarDias(inicio, i),
      )
    }

    const primeiro = new Date(
      referencia.getFullYear(),
      referencia.getMonth(),
      1,
    )

    const total = new Date(
      referencia.getFullYear(),
      referencia.getMonth() + 1,
      0,
    ).getDate()

    return [
      ...Array.from({ length: primeiro.getDay() }, () => null),
      ...Array.from(
        { length: total },
        (_, i) =>
          new Date(
            referencia.getFullYear(),
            referencia.getMonth(),
            i + 1,
          ),
      ),
    ]
  }, [visao, selecionado])

  function mover(direcao: 1 | -1) {
    if (visao === 'semana') {
      setSelecionado(iso(somarDias(ref, 7 * direcao)))
    } else {
      setSelecionado(
        iso(new Date(ref.getFullYear(), ref.getMonth() + direcao, 1)),
      )
    }
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
          <p className="pagina__descricao">
            Consulte a programação diária de chamados e viagens.
          </p>
        </div>
      </div>

      <div className="cal">
        <section
          className="cartao cal__principal"
          aria-label="Calendário de solicitações"
        >
          <div className="cal__topo">
            <h2 aria-live="polite">{titulo}</h2>

            <div className="cal__controles">
              <div
                className="cal__visao"
                role="group"
                aria-label="Visualização"
              >
                <button
                  type="button"
                  aria-pressed={visao === 'mes'}
                  onClick={() => setVisao('mes')}
                >
                  Mês
                </button>

                <button
                  type="button"
                  aria-pressed={visao === 'semana'}
                  onClick={() => setVisao('semana')}
                >
                  Semana
                </button>
              </div>

              <button
                type="button"
                className="cal__seta cal__seta--anterior"
                aria-label={visao === 'mes' ? 'Mês anterior' : 'Semana anterior'}
                onClick={() => mover(-1)}
              >
                <Icone nome="seta" tamanho={18} />
              </button>

              <button
                type="button"
                className="cal__seta cal__seta--proxima"
                aria-label={visao === 'mes' ? 'Próximo mês' : 'Próxima semana'}
                onClick={() => mover(1)}
              >
                <Icone nome="seta" tamanho={18} />
              </button>
            </div>
          </div>

          <div
            className={
              visao === 'semana'
                ? 'cal__grade cal__grade--semana'
                : 'cal__grade'
            }
          >
            {DIAS_SEMANA.map((dia) => (
              <span key={dia} className="cal__dia-semana">
                {dia}
              </span>
            ))}

            {dias.map((dia, i) => {
              if (!dia) {
                return <span key={`v${i}`} aria-hidden="true" />
              }

              const chave = iso(dia)
              const quantidade = porDia.get(chave)?.length ?? 0
              const classes = ['cal__dia']

              if (chave === selecionado) {
                classes.push('cal__dia--selecionado')
              } else if (quantidade) {
                classes.push('cal__dia--com-itens')
              }

              if (chave === hoje) {
                classes.push('cal__dia--hoje')
              }

              return (
                <button
                  key={chave}
                  type="button"
                  className={classes.join(' ')}
                  aria-pressed={chave === selecionado}
                  aria-label={`${formatarData(chave)}: ${
                    quantidade
                      ? `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`
                      : 'sem registros'
                  }`}
                  onClick={() => setSelecionado(chave)}
                >
                  <span>{dia.getDate()}</span>

                  {quantidade > 0 && (
                    <small>
                      {quantidade === 1
                        ? '1 item'
                        : `${quantidade} itens`}
                    </small>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <aside
          className="cartao cal__painel"
          aria-labelledby="cal-dia"
        >
          <div className="cal__painel-topo">
            <h2 id="cal-dia">{formatarData(selecionado)}</h2>

            <p>
              {carregando
                ? 'Carregando agendamentos...'
                : `${itensDoDia.length} ${
                    itensDoDia.length === 1
                      ? 'chamado/viagem'
                      : 'chamados/viagens'
                  }`}
            </p>
          </div>

          {erro ? (
            <div className="vazio">
              <strong>Não foi possível carregar os agendamentos</strong>
              <p>{erro}</p>
            </div>
          ) : carregando ? (
            <div className="vazio">
              <p>Buscando os agendamentos do período...</p>
            </div>
          ) : itensDoDia.length === 0 ? (
            <div className="vazio">
              <strong>Sem registros neste dia</strong>
              <p>Selecione um dia destacado no calendário.</p>
            </div>
          ) : (
            <ul className="cal__lista">
              {itensDoDia.map((solicitacao) => (
                <li key={solicitacao.id}>
                  <button
                    type="button"
                    className="cal__item"
                    onClick={() =>
                      navegar(
                        rotaSolicitacao(
                          ROTAS.solicitacoesGestor,
                          solicitacao.id,
                        ),
                      )
                    }
                  >
                    <span className="cal__item-topo">
                      <strong>
                        {solicitacao.horario} · #{solicitacao.id}
                      </strong>

                      <StatusSolicitacao status={solicitacao.status} />
                    </span>

                    <small>{solicitacao.instituicao}</small>

                    <span className="cal__rota">
                      {solicitacao.origem} → {solicitacao.destino}
                    </span>

                    <span className="cal__recursos">
                      <span>
                        <small>Motorista</small>
                        {solicitacao.motorista ?? 'Não atribuído'}
                      </span>

                      <span>
                        <small>Veículo</small>
                        {solicitacao.veiculo ?? 'Não atribuído'}
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
