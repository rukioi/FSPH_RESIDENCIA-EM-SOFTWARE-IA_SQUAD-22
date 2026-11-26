import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { MotoristaDto, EscalaMotorista, ImpedimentoMotorista } from '../../shared/services/motoristas.service';
import {
  buscarEscalasMotorista, buscarImpedimentosMotorista, buscarTransicoesMotorista,
  cadastrarEscalaMotorista, cadastrarImpedimentoMotorista, cancelarEscalaMotorista, cancelarImpedimentoMotorista,
  inativarMotorista, reativarMotorista,
} from '../../shared/services/motoristas.service';
import { ApiError } from '../../shared/api/errors';
import { obterToken } from '../../shared/services/auth.service';
import { BotaoMotorista, DialogMotorista } from './DialogMotorista';
import { useConsultaMotorista } from './useConsultaMotorista';
import { exibirInstante, validarPeriodo } from './datasDisponibilidade';
import './MotoristaDisponibilidade.css';

type Aba = 'escalas' | 'impedimentos' | 'historico';
type Acao = { tipo: 'inativar' } | { tipo: 'reativar' } | { tipo: 'cancelarEscala'; id: string } | { tipo: 'cancelarImpedimento'; id: string };
const nomes = { EM_ESCALA: 'Em escala', FORA_DE_ESCALA: 'Fora de escala', FOLGA: 'Folga', AFASTADO: 'Afastamento', VIGENTE: 'Vigente', CANCELADA: 'Cancelada', INATIVACAO: 'Inativação profissional', REATIVACAO: 'Reativação profissional' };
const mensagemErro = (erro: unknown) => erro instanceof Error ? erro.message : 'Não foi possível concluir a operação. Tente novamente.';

/** A situação profissional vem exclusivamente da API de transições, não de motorista.status. */
export function MotoristaDisponibilidade({ motorista, perfil, onAtualizarCadastro }: {
  motorista: MotoristaDto; perfil: string; onAtualizarCadastro: () => void;
}) {
  const permitido = perfil === 'ADM' || perfil === 'GESTOR_FROTA';
  // A página também é protegida pelo App; nunca monta as consultas para outro perfil.
  if (!permitido) return <p role="alert">Seu perfil não tem acesso à gestão profissional do motorista.</p>;
  return <GestaoDisponibilidade key={`${obterToken() ?? 'sem-sessao'}:${motorista.id}`} motorista={motorista} onAtualizarCadastro={onAtualizarCadastro} />;
}

function GestaoDisponibilidade({ motorista, onAtualizarCadastro }: { motorista: MotoristaDto; onAtualizarCadastro: () => void }) {
  const [aba, setAba] = useState<Aba>('escalas');
  const [paginaEscalas, setPaginaEscalas] = useState(1);
  const [paginaAusencias, setPaginaAusencias] = useState(1);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [limite, setLimite] = useState(20);
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [filtro, setFiltro] = useState<{ inicio?: string; fim?: string }>({});
  const [erroFiltro, setErroFiltro] = useState('');
  const [aviso, setAviso] = useState('');
  const [acao, setAcao] = useState<Acao | null>(null);
  const [novoPeriodo, setNovoPeriodo] = useState<'escalas' | 'impedimentos' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [situacao, setSituacao] = useState<'EM_ESCALA' | 'FORA_DE_ESCALA'>('EM_ESCALA');
  const [tipoAusencia, setTipoAusencia] = useState<'FOLGA' | 'AFASTADO'>('FOLGA');
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const vivo = useRef(false);
  const enviando = useRef(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const carregarEscalas = useCallback((signal: AbortSignal) => buscarEscalasMotorista(motorista.id, { page: paginaEscalas, limit: limite, ...filtro }, signal), [motorista.id, paginaEscalas, limite, filtro]);
  const carregarAusencias = useCallback((signal: AbortSignal) => buscarImpedimentosMotorista(motorista.id, { page: paginaAusencias, limit: limite, ...filtro }, signal), [motorista.id, paginaAusencias, limite, filtro]);
  const carregarHistorico = useCallback((signal: AbortSignal) => buscarTransicoesMotorista(motorista.id, { page: paginaHistorico, limit: limite }, signal), [motorista.id, paginaHistorico, limite]);
  const escalas = useConsultaMotorista(carregarEscalas);
  const ausencias = useConsultaMotorista(carregarAusencias);
  const historico = useConsultaMotorista(carregarHistorico);
  const consulta = aba === 'escalas' ? escalas : aba === 'impedimentos' ? ausencias : historico;
  const pagina = aba === 'escalas' ? paginaEscalas : aba === 'impedimentos' ? paginaAusencias : paginaHistorico;
  const setPagina = aba === 'escalas' ? setPaginaEscalas : aba === 'impedimentos' ? setPaginaAusencias : setPaginaHistorico;
  const meta = consulta.data?.meta;
  const ultimaPagina = Math.max(1, Math.ceil((meta?.total ?? 0) / limite));
  useEffect(() => { if (meta && pagina > ultimaPagina) setPagina(ultimaPagina); }, [meta, pagina, ultimaPagina, setPagina]);
  const inativo = historico.data?.situacao.inativo;

  function abrirAcao(proxima: Acao) { setMotivo(''); setErroModal(''); setAviso(''); setAcao(proxima); }
  function abrirPeriodo() { setInicio(''); setFim(''); setSituacao('EM_ESCALA'); setTipoAusencia('FOLGA'); setErroModal(''); setAviso(''); setNovoPeriodo(aba === 'impedimentos' ? 'impedimentos' : 'escalas'); }
  function fechar() { if (enviando.current) return; setAcao(null); setNovoPeriodo(null); setErroModal(''); }

  function aplicarFiltro(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErroFiltro('');
    try {
      if (!filtroInicio && !filtroFim) setFiltro({});
      else {
        const periodo = validarPeriodo(filtroInicio, filtroFim);
        if (periodo.fim === null) return;
        setFiltro({ inicio: periodo.inicio, fim: periodo.fim });
      }
      setPaginaEscalas(1); setPaginaAusencias(1);
    } catch (erro) { setErroFiltro(mensagemErro(erro)); }
  }

  async function gravar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando.current || (!acao && !novoPeriodo)) return;
    setErroModal('');
    let operacao: () => Promise<unknown>;
    try {
      if (acao) {
        const texto = motivo.trim();
        const maximo = acao.tipo === 'inativar' || acao.tipo === 'reativar' ? 1000 : 500;
        if (!texto || texto.length > maximo) throw new Error(`Informe uma justificativa com 1 a ${maximo} caracteres, sem contar espaços nas extremidades.`);
        if ([...texto].some(c => { const n = c.charCodeAt(0); return (n < 32 && ![9, 10, 13].includes(n)) || n === 127; })) throw new Error('Remova os caracteres de controle da justificativa.');
        const atual = acao;
        if (atual.tipo === 'inativar') {
          operacao = () => inativarMotorista(motorista.id, texto);
        } else if (atual.tipo === 'reativar') {
          operacao = () => reativarMotorista(motorista.id, texto);
        } else if (atual.tipo === 'cancelarEscala') {
          operacao = () => cancelarEscalaMotorista(motorista.id, atual.id, texto);
        } else {
          operacao = () => cancelarImpedimentoMotorista(motorista.id, atual.id, texto);
        }
      } else {
        const periodo = validarPeriodo(inicio, fim, novoPeriodo === 'impedimentos');
        if (novoPeriodo === 'escalas') {
          if (periodo.fim === null) throw new Error('Informe o término da escala.');
          const entrada = { inicio: periodo.inicio, fim: periodo.fim, situacao };
          operacao = () => cadastrarEscalaMotorista(motorista.id, entrada);
        } else {
          const entrada = { inicio: periodo.inicio, fim: periodo.fim, tipo: tipoAusencia };
          operacao = () => cadastrarImpedimentoMotorista(motorista.id, entrada);
        }
      }
    } catch (erro) { setErroModal(mensagemErro(erro)); return; }

    enviando.current = true; setSalvando(true);
    const token = obterToken();
    try {
      await operacao();
      if (!vivo.current || obterToken() !== token) return;
      setAcao(null); setNovoPeriodo(null);
      setAviso('Registro confirmado pelo servidor. As consultas estão sendo atualizadas.');
      // O transporte já emite dataChanges após a resposta validada: as três consultas fazem refetch.
      onAtualizarCadastro();
    } catch (erro) {
      if (!vivo.current || obterToken() !== token) return;
      setErroModal(mensagemErro(erro));
      if (erro instanceof ApiError && erro.status === 409) { escalas.atualizar(); ausencias.atualizar(); historico.atualizar(); }
    } finally {
      enviando.current = false;
      if (vivo.current && obterToken() === token) setSalvando(false);
    }
  }

  const tituloAcao = acao?.tipo === 'inativar' ? 'Inativar profissionalmente' : acao?.tipo === 'reativar' ? 'Reativar profissionalmente' : 'Cancelar período';
  const tituloModal = acao ? tituloAcao : novoPeriodo === 'escalas' ? 'Cadastrar escala' : 'Cadastrar ausência';
  const maximoMotivo = acao?.tipo === 'inativar' || acao?.tipo === 'reativar' ? 1000 : 500;
  return <section className="md-area" aria-labelledby="md-titulo">
    <header className="md-topo">
      <div><h2 id="md-titulo">Situação profissional, escalas e ausências</h2>
        <p>Situação profissional: <strong>{historico.carregando ? 'Consultando…' : historico.erro ? 'Não foi possível consultar' : inativo === true ? 'Inativado profissionalmente' : inativo === false ? 'Sem inativação vigente' : 'Não informada'}</strong></p>
      </div>
      <div className="md-acoes">
        <BotaoMotorista disabled={historico.carregando || Boolean(historico.erro) || inativo === undefined || salvando} variante={inativo ? 'primario' : 'perigo'} onClick={() => abrirAcao({ tipo: inativo ? 'reativar' : 'inativar' })}>{inativo ? 'Reativar profissionalmente' : 'Inativar profissionalmente'}</BotaoMotorista>
      </div>
    </header>
    <p className="md-ajuda">A situação profissional é separada do status operacional e da conta de acesso. Folga ou afastamento não significa desligamento.</p>
    {inativo === true && <p className="md-aviso">A inativação impede novas alocações. Reservas existentes e a conta de acesso não são alteradas por esta operação.</p>}
    {inativo === false && <p className="md-ajuda">A ausência de inativação não garante alocação: ausências vigentes, períodos fora de escala, reservas, CNH e conta vinculada continuam sujeitos às validações do servidor. Falta de escala e matriz CNH × classe veicular permanecem indeterminadas.</p>}
    {historico.erro && aba !== 'historico' && <div className="md-erro" role="alert">{historico.erro} <BotaoMotorista onClick={historico.atualizar}>Consultar situação novamente</BotaoMotorista></div>}
    {aviso && <p className="md-status" role="status">{aviso}</p>}
    <nav className="md-tabs" aria-label="Registros profissionais do motorista">
      <BotaoMotorista aria-pressed={aba === 'escalas'} onClick={() => setAba('escalas')}>Escalas</BotaoMotorista>
      <BotaoMotorista aria-pressed={aba === 'impedimentos'} onClick={() => setAba('impedimentos')}>Ausências</BotaoMotorista>
      <BotaoMotorista aria-pressed={aba === 'historico'} onClick={() => setAba('historico')}>Histórico profissional</BotaoMotorista>
    </nav>
    <div className="md-topo"><h3>{aba === 'escalas' ? 'Escalas registradas' : aba === 'impedimentos' ? 'Ausências registradas' : 'Inativações e reativações'}</h3>
      <div className="md-acoes"><BotaoMotorista disabled={consulta.carregando || salvando} onClick={consulta.atualizar}>Atualizar</BotaoMotorista>
        {aba !== 'historico' && <BotaoMotorista variante="primario" disabled={salvando} onClick={abrirPeriodo}>{aba === 'escalas' ? 'Cadastrar escala' : 'Cadastrar ausência'}</BotaoMotorista>}
      </div>
    </div>
    {aba !== 'historico' && <>
      <form className="md-filtros" onSubmit={aplicarFiltro}>
        <label className="md-campo">Início do filtro<input type="datetime-local" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} /></label>
        <label className="md-campo">Fim do filtro<input type="datetime-local" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} /></label>
        <div className="md-acoes md-campo--inteiro"><BotaoMotorista type="submit" disabled={salvando}>Filtrar</BotaoMotorista><BotaoMotorista disabled={salvando} onClick={() => { setFiltroInicio(''); setFiltroFim(''); setFiltro({}); setErroFiltro(''); setPaginaEscalas(1); setPaginaAusencias(1); }}>Limpar filtros</BotaoMotorista></div>
      </form>
      <p className="md-ajuda">Datas e horários em America/Maceio (UTC−03:00). O filtro consulta períodos que se sobrepõem ao intervalo informado; início e fim devem ser preenchidos juntos.</p>
      {erroFiltro && <p className="md-erro" role="alert">{erroFiltro}</p>}
    </>}
    {consulta.carregando && <p className="md-status" role="status">Consultando registros…</p>}
    {consulta.erro && <div className="md-erro" role="alert">{consulta.erro} {aviso && 'A gravação anterior foi confirmada, mas esta consulta falhou.'} <BotaoMotorista onClick={consulta.atualizar}>Tentar novamente</BotaoMotorista></div>}
    {!consulta.carregando && !consulta.erro && consulta.data?.data.length === 0 && <p className="md-vazio">Nenhum registro encontrado{aba === 'historico' ? '.' : ' para o período consultado.'}</p>}
    {!consulta.carregando && !consulta.erro && <ul className="md-registros">
      {aba === 'escalas' && escalas.data?.data.map(registro => <Periodo key={registro.id} registro={registro} titulo={nomes[registro.situacao]} ocupado={salvando} onCancelar={() => abrirAcao({ tipo: 'cancelarEscala', id: registro.id })} />)}
      {aba === 'impedimentos' && ausencias.data?.data.map(registro => <Periodo key={registro.id} registro={registro} titulo={nomes[registro.tipo]} ocupado={salvando} onCancelar={() => abrirAcao({ tipo: 'cancelarImpedimento', id: registro.id })} />)}
      {aba === 'historico' && historico.data?.data.map(registro => <li className="md-registro" key={registro.id}>
        <div className="md-registro-topo"><strong>{nomes[registro.acao]}</strong><span className="md-dados">Versão {registro.versao}</span></div>
        <p className="md-motivo">{registro.motivo}</p><p className="md-dados">Autor ID {registro.autorId} · {exibirInstante(registro.criadoEm)}</p>
      </li>)}
    </ul>}
    <footer className="md-paginacao">
      <label className="md-campo">Registros por página<select value={limite} disabled={salvando} onChange={e => { const valor = Number(e.target.value); if (![10, 20, 50, 100].includes(valor)) return; setLimite(valor); setPaginaEscalas(1); setPaginaAusencias(1); setPaginaHistorico(1); }}>
        {[10, 20, 50, 100].map(valor => <option key={valor} value={valor}>{valor}</option>)}</select></label>
      <span>{meta ? `${meta.total} registros · Página ${pagina} de ${ultimaPagina}` : 'Total não disponível'}</span>
      <div className="md-acoes"><BotaoMotorista disabled={pagina <= 1 || consulta.carregando || salvando || !meta} onClick={() => setPagina(p => p - 1)}>Anterior</BotaoMotorista><BotaoMotorista disabled={pagina >= ultimaPagina || consulta.carregando || salvando || !meta} onClick={() => setPagina(p => p + 1)}>Próxima</BotaoMotorista></div>
    </footer>
    {(acao || novoPeriodo) && <DialogMotorista rotulo="md-modal-titulo" descricao="md-modal-aviso" ocupado={salvando} onFechar={fechar}>
      <div className="md-dialog-conteudo"><h2 id="md-modal-titulo">{tituloModal}</h2>
        <p id="md-modal-aviso" className="md-ajuda">{acao?.tipo === 'inativar' ? `Inativar ${motorista.nome} impedirá novas alocações, mas não cancelará reservas existentes nem alterará sua conta de acesso.`
          : acao?.tipo === 'reativar' ? `Reativar ${motorista.nome} mantém todo o histórico. Outros impedimentos ainda podem impedir sua alocação.`
          : acao ? 'O período será cancelado, mantendo o registro original e a justificativa no histórico. Nenhuma viagem será cancelada por esta operação.'
          : 'Datas e horários em America/Maceio (UTC−03:00). Para um período noturno, informe a data seguinte no término.'}</p>
        <form onSubmit={gravar}>
          <fieldset disabled={salvando} className="md-fieldset md-form">
            {acao ? <label className="md-campo md-campo--inteiro">Justificativa administrativa (obrigatória)<textarea required maxLength={maximoMotivo} value={motivo} onChange={e => setMotivo(e.target.value)} aria-describedby="md-motivo-ajuda" /></label>
              : <>
                <label className="md-campo">Início<input type="datetime-local" required value={inicio} onChange={e => setInicio(e.target.value)} /></label>
                <label className="md-campo">{novoPeriodo === 'escalas' ? 'Término' : 'Término (opcional)'}<input type="datetime-local" required={novoPeriodo === 'escalas'} value={fim} onChange={e => setFim(e.target.value)} /></label>
                {novoPeriodo === 'escalas' ? <label className="md-campo md-campo--inteiro">Situação da escala<select value={situacao} onChange={e => setSituacao(e.target.value === 'FORA_DE_ESCALA' ? 'FORA_DE_ESCALA' : 'EM_ESCALA')}><option value="EM_ESCALA">Em escala</option><option value="FORA_DE_ESCALA">Fora de escala</option></select></label>
                  : <label className="md-campo md-campo--inteiro">Tipo de ausência<select value={tipoAusencia} onChange={e => setTipoAusencia(e.target.value === 'AFASTADO' ? 'AFASTADO' : 'FOLGA')}><option value="FOLGA">Folga</option><option value="AFASTADO">Afastamento</option></select></label>}
              </>}
          </fieldset>
          {acao && <p id="md-motivo-ajuda" className="md-ajuda">Até {maximoMotivo} caracteres. Não inclua diagnóstico ou dados médicos.</p>}
          {erroModal && <p className="md-erro" role="alert">{erroModal}</p>}
          {salvando && <p className="md-status" role="status">Enviando registro…</p>}
          <div className="md-acoes"><BotaoMotorista disabled={salvando} onClick={fechar}>Cancelar</BotaoMotorista><BotaoMotorista type="submit" variante={acao?.tipo === 'inativar' ? 'perigo' : 'primario'} disabled={salvando}>{salvando ? 'Enviando…' : acao ? 'Confirmar' : 'Salvar período'}</BotaoMotorista></div>
        </form>
      </div>
    </DialogMotorista>}
  </section>;
}

function Periodo({ registro, titulo, ocupado, onCancelar }: { registro: EscalaMotorista | ImpedimentoMotorista; titulo: string; ocupado: boolean; onCancelar: () => void }) {
  return <li className="md-registro">
    <div className="md-registro-topo"><strong>{titulo} · {nomes[registro.estado]}</strong>{registro.estado === 'VIGENTE' && <BotaoMotorista disabled={ocupado} onClick={onCancelar}>Cancelar período</BotaoMotorista>}</div>
    <p>{exibirInstante(registro.inicio)} → {exibirInstante(registro.fim)}</p>
    <p className="md-dados">Autor ID {registro.autorId} · Registrado em {exibirInstante(registro.criadoEm)}</p>
    {registro.cancelamento && <><p className="md-motivo">Cancelamento: {registro.cancelamento.motivo}</p><p className="md-dados">Autor ID {registro.cancelamento.autorId} · {exibirInstante(registro.cancelamento.em)}</p></>}
  </li>;
}
