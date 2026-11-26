import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from '../../app/routes/router';
import { ApiError, errorMessage } from '../../shared/api/errors';
import { Select } from '../../shared/components/Select';
import { Icone } from '../../shared/components/Icone';
import { SeletorVeiculoManutencao } from './SeletorVeiculoManutencao';
import {
  cadastrarManutencao, consultarManutencao, editarManutencao, transitarManutencao,
  type Detalhe, type Transicao,
} from '../../shared/services/manutencoes.service';
import type { VeiculoDto } from '../../shared/services/veiculos.service';
import {
  abrirRascunho, acoes, acoesPorEstado, campos, estados, fuso, prepararFormulario, reconciliar,
  tipos, validarJanela, vinculo, type Campo, type Erros,
} from './manutencoes.form';

export type Operacao = {modo: 'cadastro'} | {modo: 'edicao' | Transicao['acao']; id: string};
type Props = {
  operacao: Operacao; veiculos: VeiculoDto[]; catalogoCarregando: boolean; catalogoErro: string;
  recarregarCatalogo: () => void; aoFechar: () => void; aoSalvar: (d: Detalhe, cadastro: boolean) => void;
  aoAtualizarEstado: () => void; aoPerderAcesso: () => void; rotaDetalhe: (id: string) => string;
};

const obrigatorios = new Set<Campo>(['veiculoId','tipo','descricao','entrada','conclusaoPrevista','quilometragem']);

function Obrigatorio() { return <span aria-hidden="true"> *</span>; }

function CampoForm({name, erro, children, largo = false}: {
  name: Campo; erro?: string; children: (a: {'aria-label': string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: true}) => ReactNode; largo?: boolean;
}) {
  const id = useId();
  return <label className={largo ? 'manutencoes__largo' : undefined}>
    <span>{campos[name]}{obrigatorios.has(name) && <Obrigatorio/>}</span>
    {children({'aria-label': campos[name], 'aria-invalid': Boolean(erro), 'aria-describedby': erro ? id : undefined, 'aria-required': obrigatorios.has(name) ? true : undefined})}
    {erro && <small id={id} className="manutencoes__erro">{erro}</small>}
  </label>;
}

export function ManutencaoModal(props: Props) {
  const {operacao, aoFechar, aoSalvar, aoAtualizarEstado, aoPerderAcesso} = props;
  const cadastro = operacao.modo === 'cadastro';
  const id = 'id' in operacao ? operacao.id : undefined;
  const acao = operacao.modo !== 'cadastro' && operacao.modo !== 'edicao' ? operacao.modo : undefined;
  const destinoObrigatorio = acao === 'REABRIR' || acao === 'REATIVAR';
  const titulo = acao ? acoes[acao] : cadastro ? 'Registrar manutenção' : 'Editar manutenção';
  const dialogo = useRef<HTMLDialogElement>(null);
  const ocupado = useRef(false);
  const operacaoAtual = useRef<AbortController | null>(null);
  const [base, setBase] = useState<Detalhe>();
  const [rascunho, setRascunho] = useState(abrirRascunho);
  const [destino, setDestino] = useState<'' | 'AGENDADA' | 'EM_ANDAMENTO'>('');
  const [erro, setErro] = useState('');
  const [camposInvalidos, setCamposInvalidos] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(!cadastro);
  const [tentativa, setTentativa] = useState(0);
  const [conflito, setConflito] = useState(false);
  const [versaoAtual, setVersaoAtual] = useState<Detalhe>();
  const [falhaConflito, setFalhaConflito] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const [confirmarFechamento, setConfirmarFechamento] = useState(false);
  const inicial = abrirRascunho(base);
  const alterado = destino !== '' || rascunho.iniciarImediatamente ||
    (Object.keys(campos) as Campo[]).some(c => inicial[c] !== rascunho[c]);
  const permiteAcao = !acao || Boolean(base && acoesPorEstado[base.status].includes(acao));

  useEffect(() => {
    const abertoPor = document.activeElement;
    const dialog = dialogo.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      operacaoAtual.current?.abort();
      if (abertoPor instanceof HTMLElement && abertoPor.isConnected) abertoPor.focus();
    };
  }, []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setCarregando(true); setErro('');
    void consultarManutencao(id, controller.signal).then(d => {
      if (controller.signal.aborted) return;
      setBase(d); setRascunho(abrirRascunho(d));
    }).catch(e => {
      if (!controller.signal.aborted) {
        setErro(errorMessage(e));
        if (e instanceof ApiError && e.status === 404) setBloqueado(true);
        if (e instanceof ApiError && [401,403].includes(e.status)) aoPerderAcesso();
      }
    }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [id, tentativa, aoPerderAcesso]);

  function fechar() {
    if (ocupado.current) return;
    if ((alterado || conflito) && !confirmarFechamento) setConfirmarFechamento(true);
    else if (!confirmarFechamento) aoFechar();
  }
  function alterar(campo: Campo, valor: string) {
    setRascunho(r => ({...r, [campo]: valor,
      iniciarImediatamente: campo === 'tipo' && valor !== 'CORRETIVA' ? false : r.iniciarImediatamente}));
    setCamposInvalidos(v => ({...v, [campo]: undefined}));
  }
  async function obterVersaoAtual(controller: AbortController) {
    setFalhaConflito('');
    try {
      const d = await consultarManutencao(id!, controller.signal);
      if (!controller.signal.aborted) setVersaoAtual(d);
    } catch (e) {
      if (controller.signal.aborted) return;
      setFalhaConflito(errorMessage(e));
      if (e instanceof ApiError && [401,403,404].includes(e.status)) {
        setBloqueado(true);
        if (e.status !== 404) aoPerderAcesso();
      }
    }
  }
  function revisar() {
    if (!versaoAtual) return;
    setRascunho(reconciliar(inicial, rascunho, abrirRascunho(versaoAtual)));
    setBase(versaoAtual); setVersaoAtual(undefined); setConflito(false);
    setErro('Revise os valores antes de confirmar novamente.');
  }
  function repetirConsulta() {
    if (ocupado.current) return;
    operacaoAtual.current?.abort();
    const controller = new AbortController();
    operacaoAtual.current = controller;
    void obterVersaoAtual(controller);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado.current || conflito || bloqueado || !permiteAcao || (!cadastro && !base)) return;
    setErro('');
    const {erros, entrada, edicao} = prepararFormulario(rascunho, base);
    if (destinoObrigatorio && !destino) { setErro('Escolha o estado de destino.'); return; }
    const validacao = destinoObrigatorio ? validarJanela(rascunho.entrada, rascunho.conclusaoPrevista) : acao ? {} : erros;
    setCamposInvalidos(validacao);
    if (Object.keys(validacao).length) {
      setErro('Revise os campos indicados.');
      requestAnimationFrame(() => dialogo.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (!cadastro && !acao && !Object.keys(edicao).length) {setErro('Nenhuma alteração para salvar.'); return;}
    ocupado.current = true; setSalvando(true);
    const controller = new AbortController();
    operacaoAtual.current?.abort(); operacaoAtual.current = controller;
    try {
      let salvo: Detalhe;
      if (acao && base) {
        const alteracoes = destinoObrigatorio ? {
          ...(rascunho.entrada !== base.entrada ? {entrada: rascunho.entrada} : {}),
          ...(rascunho.conclusaoPrevista !== base.conclusaoPrevista ? {conclusaoPrevista: rascunho.conclusaoPrevista} : {}),
        } : {};
        const corpo = acao === 'REABRIR' || acao === 'REATIVAR'
          ? {acao, destino: destino as 'AGENDADA' | 'EM_ANDAMENTO', ...(Object.keys(alteracoes).length ? {alteracoes} : {})}
          : {acao};
        salvo = await transitarManutencao(base.id, base.versao, corpo, controller.signal);
      } else if (base) salvo = await editarManutencao(base.id, base.versao, edicao, controller.signal);
      else salvo = await cadastrarManutencao(entrada, controller.signal);
      if (!controller.signal.aborted) aoSalvar(salvo, cadastro);
    } catch (falha) {
      if (controller.signal.aborted) return;
      setErro(errorMessage(falha));
      if (falha instanceof ApiError) {
        if (falha.requestId && falha.status >= 500) setErro(errorMessage(falha) + ' Referência: ' + falha.requestId);
        if (falha.fields) setCamposInvalidos(falha.fields);
        if ([401,403,404].includes(falha.status)) {
          setBloqueado(true);
          if (falha.status !== 404) aoPerderAcesso();
        }
        if (['VERSAO_DESATUALIZADA','ESTADO_INCOMPATIVEL'].includes(falha.code)) {
          setConflito(true); setVersaoAtual(undefined);
          await obterVersaoAtual(controller);
          if (!controller.signal.aborted) aoAtualizarEstado();
        }
      }
    } finally {
      ocupado.current = false;
      if (!controller.signal.aborted) setSalvando(false);
    }
  }

  const novo = versaoAtual && abrirRascunho(versaoAtual);
  const diferencas = novo ? (Object.keys(campos) as Campo[]).filter(c => inicial[c] !== novo[c] || inicial[c] !== rascunho[c]) : [];
  const campo = (name: Campo, options: {type?: string; maxLength?: number; largo?: boolean; textarea?: boolean; placeholder?: string; inputMode?: 'numeric' | 'decimal'} = {}) => {
    const {largo, textarea, ...attrs} = options;
    return <CampoForm name={name} erro={camposInvalidos[name]} largo={largo}>{aria => textarea
      ? <textarea {...aria} {...attrs} rows={3} value={rascunho[name]} onChange={e => alterar(name,e.target.value)} />
      : <input {...aria} {...attrs} required={obrigatorios.has(name)} value={rascunho[name]} onChange={e => alterar(name,e.target.value)} />}</CampoForm>;
  };
  return <dialog ref={dialogo} className="manutencoes__modal" aria-labelledby="manutencao-modal-titulo"
    onCancel={e => { e.preventDefault(); fechar(); }}>
    <header className="manutencoes__topo">
      <div><h2 id="manutencao-modal-titulo">{titulo}</h2>{!acao && <p>Serviço preventivo ou corretivo do veículo.</p>}</div>
      <button type="button" className="manutencoes__modal-fechar" aria-label="Fechar" onClick={fechar} disabled={salvando}><Icone nome="fechar"/></button>
    </header>
    {carregando && <p role="status">Carregando manutenção...</p>}
    {erro && <p role="alert" className="manutencoes__erro">{erro}</p>}
    {!cadastro && !carregando && !base && !bloqueado && <button type="button" className="btn btn--secundario" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</button>}
    {conflito && !bloqueado && <section className="manutencoes__conflito" aria-label="Conflito de versão">
      <h3>A manutenção foi alterada</h3>
      <p>Seu rascunho está preservado. Confira os valores antes de enviar novamente.</p>
      {versaoAtual && novo && <>
        <p>Estado atual: {estados[versaoAtual.status]}.</p>
        {diferencas.map(c => <div className="manutencoes__comparacao" key={c}>
          <strong>{campos[c]}</strong>
          <span>Original: {inicial[c] || 'Não informado'}</span>
          <span>Atual: {novo[c] || 'Não informado'}</span>
          <span>Seu rascunho: {rascunho[c] || 'Não informado'}</span>
          {inicial[c] !== novo[c] && inicial[c] !== rascunho[c] && rascunho[c] !== novo[c] && <strong>Alteração concorrente neste campo</strong>}
        </div>)}
        <div className="manutencoes__acoes">
          <button className="btn btn--secundario" type="button" onClick={() => setConfirmarFechamento(true)}>Descartar rascunho</button>
          <button className="btn btn--primario" type="button" onClick={revisar}>Revisar com os dados atuais</button>
        </div>
      </>}
      {falhaConflito && <p role="alert">{falhaConflito} <button type="button" className="btn btn--secundario" onClick={repetirConsulta}>Tentar novamente</button></p>}
    </section>}
    {confirmarFechamento && <section className="manutencoes__conflito" role="group" aria-label="Descartar alterações">
      <p>Descartar as alterações digitadas?</p>
      <div className="manutencoes__acoes">
        <button type="button" className="btn btn--secundario" onClick={() => setConfirmarFechamento(false)}>Continuar editando</button>
        <button type="button" className="btn btn--perigo" onClick={aoFechar}>Descartar</button>
      </div>
    </section>}
    {!permiteAcao && base && <p role="alert">A ação não é compatível com o estado atual. <Link para={props.rotaDetalhe(base.id)}>Ver manutenção</Link></p>}
    {!carregando && (cadastro || base) && !bloqueado && <form noValidate onSubmit={enviar}>
      <fieldset className="manutencoes__form" disabled={salvando || conflito || confirmarFechamento || !permiteAcao}>
        {acao ? <>
          <p className="manutencoes__largo">{acao === 'CANCELAR' ? 'Confirme o cancelamento desta manutenção.' : 'Confirme a ação para esta manutenção.'}</p>
          {destinoObrigatorio && <>
            <label className="manutencoes__largo">Estado de destino
              <Select value={destino} onChange={e => setDestino(e.target.value as typeof destino)}>
                <option value="">Selecione o estado de destino</option><option value="AGENDADA">Agendada</option><option value="EM_ANDAMENTO">Em andamento</option>
              </Select>
            </label>
            {campo('entrada',{type:'date'})}{campo('conclusaoPrevista',{type:'date'})}
          </>}
        </> : <>
          {cadastro ? <div className="manutencoes__seletor">
            <CampoForm name="veiculoId" erro={camposInvalidos.veiculoId}>{aria =>
              <SeletorVeiculoManutencao {...aria} veiculos={props.veiculos} valor={rascunho.veiculoId}
                desabilitado={props.catalogoCarregando || Boolean(props.catalogoErro) || !props.veiculos.length}
                aoSelecionar={id => alterar('veiculoId',id)}/>}
            </CampoForm>
            {props.catalogoCarregando && <small role="status">Carregando veículos...</small>}
            {props.catalogoErro && <p role="alert">{props.catalogoErro} <button className="btn btn--secundario" type="button" onClick={props.recarregarCatalogo}>Tentar novamente</button></p>}
            {!props.catalogoCarregando && !props.catalogoErro && !props.veiculos.length && <small role="status">Nenhum veículo encontrado.</small>}
          </div> : <label><span>Veículo<Obrigatorio/></span><input aria-label="Veículo" aria-required="true" readOnly value={base ? base.veiculo.placa + ' · ' + vinculo[base.veiculo.vinculo] : ''} /></label>}
          <CampoForm name="tipo" erro={camposInvalidos.tipo}>{aria =>
            <Select {...aria} required value={rascunho.tipo} onChange={e => alterar('tipo',e.target.value)}>
              {Object.entries(tipos).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </Select>}</CampoForm>
          {campo('descricao',{maxLength:2000,largo:true})}
          {campo('entrada',{type:'date'})}{campo('conclusaoPrevista',{type:'date'})}
          {campo('quilometragem',{inputMode:'numeric'})}{campo('prestador',{maxLength:255})}
          {campo('custo',{inputMode:'decimal',placeholder:'Ex.: 1250,50'})}
          <div className="manutencoes__status-form">
            <label><span>Status<Obrigatorio/></span><input readOnly aria-label="Status" aria-required="true"
              value={estados[base?.status ?? (rascunho.iniciarImediatamente ? 'EM_ANDAMENTO' : 'AGENDADA')]}/></label>
            {cadastro && rascunho.tipo === 'CORRETIVA' &&
              <label className="manutencoes__check"><input type="checkbox" checked={rascunho.iniciarImediatamente}
                onChange={e => setRascunho(r => ({...r,iniciarImediatamente:e.target.checked}))} /> Iniciar imediatamente</label>}
          </div>
          {campo('observacoes',{textarea:true,largo:true,maxLength:2000})}
          {base?.status === 'CONCLUIDA' && <>
            <div className="manutencoes__largo"><h3>Correção de datas operacionais</h3><p>{fuso} · Formato AAAA-MM-DD HH:mm:ss, com fração opcional</p></div>
            {campo('iniciadaEm')}{campo('concluidaEm')}
          </>}
        </>}
      </fieldset>
      <footer className="manutencoes__acoes manutencoes__modal-rodape">
        <button className="btn btn--secundario" type="button" onClick={fechar} disabled={salvando}>{acao ? 'Voltar' : 'Cancelar'}</button>
        <button className="btn btn--primario" disabled={salvando || conflito || confirmarFechamento || !permiteAcao ||
          (cadastro && (props.catalogoCarregando || Boolean(props.catalogoErro) || !props.veiculos.length))}>
          {salvando ? 'Salvando...' : acao ? (acao === 'CANCELAR' ? 'Confirmar cancelamento' : 'Confirmar') : cadastro ? 'Registrar' : 'Salvar alterações'}
        </button>
      </footer>
      {salvando && <p role="status">Aguardando confirmação do servidor...</p>}
    </form>}
  </dialog>;
}
