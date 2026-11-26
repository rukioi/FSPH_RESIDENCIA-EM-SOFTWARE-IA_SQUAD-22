import { useEffect, useMemo, useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'
import { IconeGestor as Icone } from '../../shared/components/IconeGestor'
import {
  agendarSolicitacao,
  aprovarSolicitacao,
  buscarDetalheSolicitacao,
  buscarDisponibilidade,
  listarSolicitacoes,
} from '../../shared/services/solicitacoes.service'
import { buscarMotoristas, type MotoristaDto } from '../../shared/services/motoristas.service'
import { buscarVeiculos, type VeiculoDto } from '../../shared/services/veiculos.service'
import { formatarData } from '../../features/solicitacoes/regras'
import '../../features/solicitacoes/solicitacoes.css'
import './AprovarSolicitacao.css'

type Detalhe = Awaited<ReturnType<typeof buscarDetalheSolicitacao>>
type SolicitacaoItem = Record<string, unknown>

/** Fuso institucional usado pelo backend (America/Maceio). */
const OFFSET = '-03:00'

/** Quantidade máxima de solicitações/viagens atribuídas ao mesmo motorista. */
const LIMITE_VIAGENS_MOTORISTA = 3

/** Status que não ocupam vaga ativa de solicitação/corrida. */
const STATUS_ENCERRADOS = new Set(['CONCLUIDA', 'CONCLUIDO', 'CANCELADA', 'CANCELADO', 'REPROVADA', 'REPROVADO'])

const STATUS_MOTORISTA: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  EM_VIAGEM: 'Em viagem',
  FOLGA: 'Folga',
  AFASTADO: 'Afastado',
}

const STATUS_VEICULO: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  EM_VIAGEM: 'Em uso',
  EM_USO: 'Em uso',
  EM_MANUTENCAO: 'Em manutenção',
  INDISPONIVEL: 'Indisponível',
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

/** "2026-11-19T18:45:00.000000-03:00" -> { data: "2026-11-19", horario: "18:45" } */
function separar(iso: string) {
  return { data: iso.slice(0, 10), horario: iso.slice(11, 16) }
}

/** Soma horas a data/horário locais sem depender do fuso do navegador. */
function somarHoras(data: string, horario: string, horas: number) {
  const base = new Date(`${data}T${horario}:00Z`)
  base.setUTCHours(base.getUTCHours() + horas)
  return { data: base.toISOString().slice(0, 10), horario: base.toISOString().slice(11, 16) }
}

/** Normaliza o retorno de listarSolicitacoes para array de itens. */
function extrairListaSolicitacoes(resposta: unknown): SolicitacaoItem[] {
  if (Array.isArray(resposta)) {
    return resposta as SolicitacaoItem[]
  }
  if (resposta && typeof resposta === 'object') {
    const obj = resposta as Record<string, unknown>
    for (const chave of ['itens', 'items', 'data', 'solicitacoes', 'resultados', 'content']) {
      if (Array.isArray(obj[chave])) {
        return obj[chave] as SolicitacaoItem[]
      }
    }
  }
  return []
}

/** Extrai o ID do motorista vinculado a uma solicitação, se houver. */
function extrairMotoristaIdSolicitacao(sol: SolicitacaoItem): string | null {
  const motoristaObj = sol.motorista as Record<string, unknown> | undefined
  const bruto =
    sol.motoristaId ??
    sol.motorista_id ??
    motoristaObj?.id ??
    null

  if (bruto === null || bruto === undefined || bruto === '') return null
  return String(bruto)
}

/** Extrai o ID do veículo vinculado a uma solicitação, se houver. */
function extrairVeiculoIdSolicitacao(sol: SolicitacaoItem): string | null {
  const veiculoObj = sol.veiculo as Record<string, unknown> | undefined
  const bruto =
    sol.veiculoId ??
    sol.veiculo_id ??
    veiculoObj?.id ??
    null

  if (bruto === null || bruto === undefined || bruto === '') return null
  return String(bruto)
}

/** Conta solicitações ativas atribuídas ao motorista a partir da lista de solicitações (ou fallback no DTO). */
function contarSolicitacoesDoMotorista(
  motorista: MotoristaDto,
  solicitacoes: SolicitacaoItem[],
  solicitacaoAtualId: string,
  contagemPorSolicitacoesCarregou: boolean,
): number {
  const idMotorista = String(motorista.id)

  if (contagemPorSolicitacoesCarregou) {
    let total = 0
    for (const sol of solicitacoes) {
      const solId = String(sol.id ?? '')
      if (solId && solId === String(solicitacaoAtualId)) continue

      const status = String(sol.status ?? '').toUpperCase()
      if (STATUS_ENCERRADOS.has(status)) continue

      if (extrairMotoristaIdSolicitacao(sol) === idMotorista) {
        total += 1
      }
    }
    return total
  }

  const reg = motorista as unknown as Record<string, unknown>
  const candidatos = [
    reg.solicitacoesAtribuidas,
    reg.solicitacoes_atribuidas,
    reg.viagensAtribuidas,
    reg.viagens_atribuidas,
    reg.totalViagens,
    reg.total_viagens,
  ]
  for (const valor of candidatos) {
    if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0) {
      return Math.floor(valor)
    }
  }
  return 0
}

/** Verifica se o veículo está atrelado a alguma corrida/solicitação ativa. */
function veiculoEstaEmUso(
  veiculo: VeiculoDto,
  solicitacoes: SolicitacaoItem[],
  solicitacaoAtualId: string,
  solicitacoesCarregadas: boolean,
): boolean {
  const statusVeiculo = String(veiculo.status ?? '').toUpperCase()
  if (statusVeiculo === 'EM_VIAGEM' || statusVeiculo === 'EM_USO') {
    return true
  }

  if (solicitacoesCarregadas) {
    const idVeiculo = String(veiculo.id)
    for (const sol of solicitacoes) {
      const solId = String(sol.id ?? '')
      if (solId && solId === String(solicitacaoAtualId)) continue

      const statusSol = String(sol.status ?? '').toUpperCase()
      if (STATUS_ENCERRADOS.has(statusSol)) continue

      if (extrairVeiculoIdSolicitacao(sol) === idVeiculo) {
        return true
      }
    }
  }

  return false
}

export function AprovarSolicitacao({ id }: { id: string }) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [motoristas, setMotoristas] = useState<MotoristaDto[]>([])
  const [veiculos, setVeiculos] = useState<VeiculoDto[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[]>([])
  const [solicitacoesCarregadas, setSolicitacoesCarregadas] = useState(false)
  const [disponiveis, setDisponiveis] = useState<{ motoristas: Set<string>; veiculos: Set<string> } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [consultandoDisp, setConsultandoDisp] = useState(false)
  const [erro, setErro] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)

  const [veiculoId, setVeiculoId] = useState('')
  const [motoristaId, setMotoristaId] = useState('')
  const [retornoData, setRetornoData] = useState('')
  const [retornoHorario, setRetornoHorario] = useState('')

  // Carrega a solicitação, os cadastros de veículos/motoristas e as solicitações para contagem.
  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        setCarregando(true)
        setErro('')
        const [sol, listaMotoristas, listaVeiculos, respostaSolicitacoes] = await Promise.all([
          buscarDetalheSolicitacao(id),
          buscarMotoristas(),
          buscarVeiculos(),
          (listarSolicitacoes as () => Promise<unknown>)().catch(() => null),
        ])
        if (!ativo) return
        setDetalhe(sol)
        setMotoristas(listaMotoristas)
        setVeiculos(listaVeiculos)
        if (respostaSolicitacoes !== null) {
          setSolicitacoes(extrairListaSolicitacoes(respostaSolicitacoes))
          setSolicitacoesCarregadas(true)
        }
        // Sugere retorno 2h após a saída; o gestor pode ajustar.
        const saida = separar(sol.dataHoraSaida)
        const retorno = sol.dataHoraRetornoPrevisto
          ? separar(sol.dataHoraRetornoPrevisto)
          : somarHoras(saida.data, saida.horario, 2)
        setRetornoData(retorno.data)
        setRetornoHorario(retorno.horario)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a solicitação.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregar()
    return () => { ativo = false }
  }, [id])

  const retornoIso = retornoData && retornoHorario ? `${retornoData}T${retornoHorario}:00${OFFSET}` : ''
  const retornoValido = Boolean(detalhe && retornoIso && Date.parse(retornoIso) > Date.parse(detalhe.dataHoraSaida))

  // Consulta quem está livre entre a saída e o retorno previsto.
  useEffect(() => {
    if (!detalhe || !retornoValido) {
      setDisponiveis(null)
      return
    }
    let ativo = true
    const timer = window.setTimeout(async () => {
      try {
        setConsultandoDisp(true)
        const r = await buscarDisponibilidade({ inicio: detalhe.dataHoraSaida, fim: retornoIso })
        if (!ativo) return
        setDisponiveis({
          motoristas: new Set(r.motoristas.map((m) => String(m.id))),
          veiculos: new Set(r.veiculos.map((v) => String(v.id))),
        })
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível consultar a disponibilidade.')
      } finally {
        if (ativo) setConsultandoDisp(false)
      }
    }, 300)
    return () => { ativo = false; window.clearTimeout(timer) }
  }, [detalhe, retornoIso, retornoValido])

  const passageiros = detalhe?.qtdPassageiros ?? 1

  const listaVeiculos = useMemo(() => veiculos
    .filter((v) => !v.is_svo)
    .map((v) => {
      const capacidadeOk = v.capacidade_passageiros == null || v.capacidade_passageiros >= passageiros
      const emUso = veiculoEstaEmUso(v, solicitacoes, id, solicitacoesCarregadas)
      const livre = (disponiveis?.veiculos.has(String(v.id)) ?? false) && !emUso
      const selecionavel = livre && capacidadeOk

      let motivo = 'Disponível'
      if (!capacidadeOk) {
        motivo = `Capacidade ${v.capacidade_passageiros}`
      } else if (emUso) {
        motivo = 'Em uso'
      } else if (!livre) {
        motivo = v.status && v.status !== 'DISPONIVEL' ? STATUS_VEICULO[v.status] : 'Ocupado no horário'
      }

      return { ...v, id: String(v.id), emUso, selecionavel, motivo }
    })
    .sort((a, b) => Number(b.selecionavel) - Number(a.selecionavel)), [veiculos, solicitacoes, id, solicitacoesCarregadas, disponiveis, passageiros])

  const listaMotoristas = useMemo(() => motoristas
    .map((m) => {
      const viagensAtuais = contarSolicitacoesDoMotorista(m, solicitacoes, id, solicitacoesCarregadas)
      const dentroDoLimite = viagensAtuais < LIMITE_VIAGENS_MOTORISTA
      const bloqueadoPorStatus = m.status === 'FOLGA' || m.status === 'AFASTADO'
      const livreNaConsulta = disponiveis?.motoristas.has(String(m.id)) ?? false
      const selecionavel = dentroDoLimite && !bloqueadoPorStatus && (livreNaConsulta || viagensAtuais > 0)

      let motivo = `Disponível (${viagensAtuais}/${LIMITE_VIAGENS_MOTORISTA} viagens)`
      if (!dentroDoLimite) {
        motivo = `Limite (${viagensAtuais}/${LIMITE_VIAGENS_MOTORISTA})`
      } else if (bloqueadoPorStatus && m.status) {
        motivo = STATUS_MOTORISTA[m.status] ?? 'Indisponível'
      } else if (!selecionavel) {
        motivo = `Indisponível (${viagensAtuais}/${LIMITE_VIAGENS_MOTORISTA})`
      }

      return {
        ...m,
        id: String(m.id),
        viagensAtuais,
        selecionavel,
        motivo,
      }
    })
    .sort((a, b) => Number(b.selecionavel) - Number(a.selecionavel) || a.viagensAtuais - b.viagensAtuais), [motoristas, solicitacoes, id, solicitacoesCarregadas, disponiveis])

  // Se a seleção deixar de estar disponível (ex.: mudou o retorno), limpa.
  useEffect(() => {
    if (!disponiveis) return
    if (veiculoId && !listaVeiculos.some((v) => v.id === veiculoId && v.selecionavel)) setVeiculoId('')
    if (motoristaId && !listaMotoristas.some((m) => m.id === motoristaId && m.selecionavel)) setMotoristaId('')
  }, [disponiveis, veiculoId, motoristaId, listaVeiculos, listaMotoristas])

  // Modal: fecha com Esc (exceto durante o envio) e trava a rolagem da página.
  useEffect(() => {
    if (!modalAberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !enviando) setModalAberto(false)
    }
    document.addEventListener('keydown', aoPressionarTecla)
    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', aoPressionarTecla)
    }
  }, [modalAberto, enviando])

  const veiculoSel = listaVeiculos.find((v) => v.id === veiculoId)
  const motoristaSel = listaMotoristas.find((m) => m.id === motoristaId)
  const podeConfirmar = Boolean(veiculoSel && motoristaSel && retornoValido && !enviando)

  function abrirModal() {
    if (!podeConfirmar) return
    setErroEnvio('')
    setModalAberto(true)
  }

  function fecharModal() {
    if (enviando) return
    setModalAberto(false)
  }

  async function confirmar() {
    if (!detalhe || !podeConfirmar) return
    setEnviando(true)
    setErroEnvio('')
    try {
      // 1) Aprova (se ainda estiver pendente). 2) Agenda com veículo e motorista.
      if (detalhe.status === 'PENDENTE') {
        await aprovarSolicitacao(id)
        setDetalhe({ ...detalhe, status: 'APROVADA' })
      }
      await agendarSolicitacao(id, {
        motoristaId,
        veiculoId,
        dataHoraRetornoPrevisto: retornoIso,
      })
      setModalAberto(false)
      navegar(ROTAS.solicitacoesGestor)
    } catch (e) {
      setErroEnvio(
        (e instanceof Error ? e.message : 'Não foi possível concluir a aprovação.') +
        (detalhe.status === 'PENDENTE' ? '' : ' A solicitação já está aprovada; escolha outro veículo/motorista e tente de novo.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return <div className="sol-carregando" aria-busy="true" aria-label="Carregando"><span /><span /><span /></div>
  }

  if (erro && !detalhe) {
    return (
      <div className="cartao vazio" role="alert">
        <strong>Não foi possível abrir a aprovação</strong>
        <p>{erro}</p>
        <button type="button" className="btn btn--secundario" onClick={() => navegar(ROTAS.solicitacoesGestor)}>Voltar</button>
      </div>
    )
  }

  if (!detalhe) return null

  if (detalhe.status !== 'PENDENTE' && detalhe.status !== 'APROVADA') {
    return (
      <div className="cartao vazio">
        <strong>Esta solicitação não pode mais ser aprovada</strong>
        <p>Somente solicitações pendentes ou aprovadas sem agendamento podem receber veículo e motorista.</p>
        <button type="button" className="btn btn--secundario" onClick={() => navegar(ROTAS.solicitacoesGestor)}>Voltar</button>
      </div>
    )
  }

  const saida = separar(detalhe.dataHoraSaida)

  return (
    <div className="aprovar">
      <button type="button" className="aprovar__voltar" onClick={() => navegar(ROTAS.solicitacoesGestor)}>
        ← Solicitações
      </button>

      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Aprovar solicitação {detalhe.codigoExibicao}</h1>
          <p className="pagina__descricao">Selecione o veículo e o motorista disponíveis para o atendimento (até {LIMITE_VIAGENS_MOTORISTA} viagens por motorista).</p>
        </div>
      </div>

      {erro && <p className="sol-aviso sol-aviso--erro" role="alert">{erro}</p>}

      <div className="aprovar__grade">
        <div>
          <section className="cartao sol-cartao">
            <div className="sol-cartao__topo">
              <div>
                <h2>Período da viagem</h2>
                <p>A disponibilidade é calculada entre a saída e o retorno previsto.</p>
              </div>
            </div>
            <div className="sol-cartao__corpo sol-grade">
              <div className="campo">
                <label htmlFor="ap-retorno-data">Data do retorno</label>
                <input id="ap-retorno-data" type="date" value={retornoData} min={saida.data} onChange={(e) => setRetornoData(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="ap-retorno-hora">Horário do retorno</label>
                <input id="ap-retorno-hora" type="time" value={retornoHorario} onChange={(e) => setRetornoHorario(e.target.value)} />
              </div>
              {!retornoValido && <span className="campo__erro sol-grade__inteiro">O retorno deve ser posterior à saída ({formatarData(saida.data)} · {saida.horario}).</span>}
            </div>
          </section>

          <section className="cartao sol-cartao">
            <div className="sol-cartao__topo">
              <div>
                <h2>1. Selecionar veículo</h2>
                <p>Veículos já atrelados a uma corrida ficam marcados como Em uso.</p>
              </div>
            </div>
            <div className="sol-cartao__corpo aprovar__opcoes" role="radiogroup" aria-label="Veículos">
              {consultandoDisp && <p className="campo__ajuda">Consultando disponibilidade...</p>}
              {listaVeiculos.length === 0 && <p className="campo__ajuda">Nenhum veículo cadastrado.</p>}
              {listaVeiculos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={veiculoId === v.id}
                  disabled={!v.selecionavel}
                  className={`aprovar__opcao${veiculoId === v.id ? ' aprovar__opcao--ativa' : ''}`}
                  onClick={() => setVeiculoId(v.id)}
                >
                  <span className="aprovar__avatar"><Icone nome="veiculos" tamanho={18} /></span>
                  <span className="aprovar__info">
                    <strong>{v.modelo}</strong>
                    <span>
                      <em
                        className={
                          v.emUso
                            ? 'aprovar__tag aprovar__tag--em-uso'
                            : v.selecionavel
                              ? 'aprovar__tag aprovar__tag--ok'
                              : 'aprovar__tag'
                        }
                      >
                        {v.motivo}
                      </em>
                      {v.placa}{v.capacidade_passageiros ? ` · ${v.capacidade_passageiros} lugares` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="cartao sol-cartao">
            <div className="sol-cartao__topo">
              <div>
                <h2>2. Selecionar motorista</h2>
                <p>É possível atribuir até {LIMITE_VIAGENS_MOTORISTA} viagens ao mesmo motorista.</p>
              </div>
            </div>
            <div className="sol-cartao__corpo aprovar__opcoes" role="radiogroup" aria-label="Motoristas">
              {listaMotoristas.length === 0 && <p className="campo__ajuda">Nenhum motorista cadastrado.</p>}
              {listaMotoristas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={motoristaId === m.id}
                  disabled={!m.selecionavel}
                  className={`aprovar__opcao${motoristaId === m.id ? ' aprovar__opcao--ativa' : ''}`}
                  onClick={() => setMotoristaId(m.id)}
                >
                  <span className="aprovar__avatar">{iniciais(m.nome)}</span>
                  <span className="aprovar__info">
                    <strong>{m.nome}</strong>
                    <span>
                      <em className={m.selecionavel ? 'aprovar__tag aprovar__tag--ok aprovar__tag--motorista' : 'aprovar__tag aprovar__tag--motorista'}>
                        {m.motivo}
                      </em>
                      CNH {m.categoria_cnh}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="cartao aprovar__resumo">
          <h2>Resumo</h2>
          <dl>
            <div><dt>Solicitante</dt><dd>{detalhe.solicitante?.nome ?? '—'}</dd></div>
            <div><dt>Origem</dt><dd>{detalhe.origem}</dd></div>
            <div><dt>Destino</dt><dd>{detalhe.destino}</dd></div>
            <div><dt>Passageiros</dt><dd>{detalhe.qtdPassageiros ?? '—'}</dd></div>
            <div><dt>Data</dt><dd>{formatarData(saida.data)}</dd></div>
            <div><dt>Horário</dt><dd>{saida.horario}</dd></div>
            <div><dt>Retorno previsto</dt><dd>{retornoValido ? `${formatarData(retornoData)} · ${retornoHorario}` : '—'}</dd></div>
            <div><dt>Veículo selecionado</dt><dd>{veiculoSel ? `${veiculoSel.modelo} · ${veiculoSel.placa}` : 'Não selecionado'}</dd></div>
            <div><dt>Motorista selecionado</dt><dd>{motoristaSel ? `${motoristaSel.nome} (${motoristaSel.viagensAtuais}/${LIMITE_VIAGENS_MOTORISTA})` : 'Não selecionado'}</dd></div>
          </dl>
          <div className="aprovar__acoes">
            <button type="button" className="btn btn--primario" disabled={!podeConfirmar} onClick={abrirModal}>
              <Icone nome="check" tamanho={18} /> Confirmar aprovação
            </button>
            <button type="button" className="btn btn--secundario" disabled={enviando} onClick={() => navegar(ROTAS.solicitacoesGestor)}>
              Cancelar
            </button>
            {!podeConfirmar && !enviando && (
              <p className="campo__ajuda">Selecione um veículo e um motorista disponíveis para confirmar.</p>
            )}
          </div>
        </aside>
      </div>

      {modalAberto && veiculoSel && motoristaSel && (
        <div className="aprovar-modal__fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="aprovar-modal" role="dialog" aria-modal="true" aria-labelledby="aprovar-modal-titulo">
            <button type="button" className="aprovar-modal__fechar" aria-label="Fechar" disabled={enviando} onClick={fecharModal}>
              ×
            </button>
            <h2 id="aprovar-modal-titulo">Confirmar aprovação?</h2>
            <p className="aprovar-modal__texto">
              Este chamado será aprovado e o veículo e motorista selecionados serão vinculados ao atendimento.
            </p>

            <dl className="aprovar-modal__resumo">
              <div><dt>Chamado</dt><dd>{detalhe.codigoExibicao}</dd></div>
              <div><dt>Veículo</dt><dd>{veiculoSel.placa} · {veiculoSel.modelo}</dd></div>
              <div><dt>Motorista</dt><dd>{motoristaSel.nome} ({motoristaSel.viagensAtuais + 1}/{LIMITE_VIAGENS_MOTORISTA})</dd></div>
              <div><dt>Data</dt><dd>{formatarData(saida.data)}</dd></div>
              <div><dt>Horário</dt><dd>{saida.horario}</dd></div>
            </dl>

            {erroEnvio && <p className="campo__erro aprovar-modal__erro" role="alert">{erroEnvio}</p>}

            <div className="aprovar-modal__acoes">
              <button type="button" className="btn btn--secundario" disabled={enviando} onClick={fecharModal}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primario" disabled={enviando} onClick={() => void confirmar()}>
                {enviando ? 'Confirmando...' : 'Confirmar aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}