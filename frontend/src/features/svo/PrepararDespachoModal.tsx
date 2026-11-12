import { useCallback, useEffect, useRef, useState } from "react";
import type { DetalheOrdemSvo, OcupacaoSvo, RecursosDisponiveisSvo } from "../../shared/types/svo";
import { useRemoteData } from '../../shared/api/useRemoteData';
import { ApiError } from '../../shared/api/errors';
import { consultarOcupacaoSvo, consultarOrdemSvo } from '../../shared/services/svo.service';
import { estadosOrdem, nomeStatusSvo } from './apresentacaoSvo';
import { Select } from '../../shared/components/Select';
import "./PrepararDespachoModal.css";

type PrepararDespachoModalProps = {
  ordemId: string;
  ordemApiId: string;
  motoristas: RecursosDisponiveisSvo['motoristas'];
  veiculos: RecursosDisponiveisSvo['veiculos'];
  carregandoRecursos: boolean;
  erroRecursos: string;
  onAtualizarRecursos: () => void;
  onFechar: () => void;
  onConfirmar: (
    motoristaId: number,
    veiculoId: number,
  ) => void | Promise<void>;
};

/** Aguarda o despacho e mantém a seleção aberta quando a API informa conflito ou falha. */
export function PrepararDespachoModal({
  ordemId,
  ordemApiId,
  motoristas,
  veiculos,
  carregandoRecursos,
  erroRecursos,
  onAtualizarRecursos,
  onFechar,
  onConfirmar,
}: PrepararDespachoModalProps) {
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const envio = useRef(false);
  const ativa = useRef(false);
  const modal = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const carregarOrdem = useCallback((signal:AbortSignal)=>consultarOrdemSvo(ordemApiId,signal),[ordemApiId]);
  const ordem = useRemoteData<DetalheOrdemSvo | null>(carregarOrdem,null);
  const carregarOcupacao = useCallback((signal:AbortSignal)=>veiculoId ? consultarOcupacaoSvo(veiculoId,signal) : Promise.resolve(null),[veiculoId]);
  const ocupacao = useRemoteData<OcupacaoSvo | null>(carregarOcupacao,null);
  const quantidade = ordem.data?.quantidadeCorpos;
  const ordemValida = !ordem.loading && !ordem.error && ordem.data?.status==='PENDENTE_ALOCACAO'
    && ordem.data.statusTriagem==='CONFIRMADA_SVO' && quantidade!=null && quantidade>=1 && quantidade<=4;
  const selecionado = veiculos.find(v=>v.id===veiculoId);
  const atual = !ocupacao.loading && !ocupacao.error && ocupacao.data?.id===veiculoId ? ocupacao.data : null;
  const idsValidos = [ordemApiId,motoristaId,veiculoId].every(id=>Number.isSafeInteger(Number(id))&&Number(id)>0);
  const podeConfirmar = !carregandoRecursos && !erroRecursos && ordemValida && idsValidos
    && motoristas.some(m=>m.id===motoristaId) && selecionado?.disponivel
    && selecionado.ocupacao + (quantidade ?? 0) <= selecionado.capacidade
    && atual?.disponivel && atual.ocupacao + (quantidade ?? 0) <= atual.capacidade;
  useEffect(()=>{
    ativa.current=true;
    const anterior=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const elemento = modal.current;
    elemento?.showModal();
    titulo.current?.focus();
    return ()=>{
      ativa.current=false;
      elemento?.close();
      requestAnimationFrame(()=>{
        if(anterior?.isConnected && !anterior.matches(':disabled')) anterior.focus();
        else document.querySelector<HTMLElement>('main')?.focus();
      });
    };
  },[]);

  function atualizar() {
    onAtualizarRecursos();ocupacao.retry();ordem.retry();
  }

  async function handleConfirmar() {
    if (!podeConfirmar || envio.current) {
      return;
    }

    envio.current=true;
    // O controle acionado será desabilitado; preserve o foco dentro do diálogo nativo.
    titulo.current?.focus();
    setErro("");
    setEnviando(true);

    try {
      await onConfirmar(
        Number(motoristaId),
        Number(veiculoId),
      );
    } catch (error) {
      if(!ativa.current)return;
      if(error instanceof ApiError && [404,409].includes(error.status)) {
        ocupacao.retry();ordem.retry();
      }
      setErro(
        error instanceof Error
          ? `${error instanceof ApiError && error.status ? `Erro ${error.status}: ` : ''}${error.message}`
          : "Não foi possível realizar o despacho.",
      );
    } finally {
      envio.current=false;
      if(ativa.current)setEnviando(false);
    }
  }

  return (
    <dialog ref={modal} className="svo-modal__fundo" aria-labelledby="svo-modal-titulo"
      onCancel={event=>{event.preventDefault();if(!envio.current)onFechar();}}
      onKeyDown={event=>{
        if(event.key!=='Tab') return;
        if(envio.current){event.preventDefault();titulo.current?.focus();return;}
        const itens=Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])
          .filter(item=>item.getClientRects().length>0);
        const primeiro=itens[0], ultimo=itens.at(-1);
        if(event.shiftKey && (document.activeElement===primeiro || document.activeElement===titulo.current)) {
          event.preventDefault();ultimo?.focus();
        } else if(!event.shiftKey && document.activeElement===ultimo) {
          event.preventDefault();primeiro?.focus();
        }
      }}>
      <div
        className="svo-modal"
      >
        <header className="svo-modal__cabecalho">
          <div>
            <h2 id="svo-modal-titulo" ref={titulo} tabIndex={-1}>
              Preparar despacho
            </h2>
            <p>Ordem de coleta #{ordemId}</p>
          </div>

          <button
            type="button"
            className="svo-modal__fechar"
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="svo-modal__conteudo">
          {ordem.loading && <p role="status">Consultando ordem…</p>}
          {ordem.error && <p role="alert">{ordem.error}</p>}
          {!ordem.loading && !ordem.error && ordem.data && <div>
            <p>{ordem.data.codigo} · {ordem.data.solicitacaoCodigo}</p>
            <p>Status: {nomeStatusSvo(ordem.data.status, estadosOrdem)}</p>
            <p>{ordem.data.enderecoRemocao}</p>
            <p>Quantidade de corpos: {quantidade ?? 'Não informada'}</p>
            {!ordemValida && <p role="alert">Esta ordem não permite despacho. Consulte a situação e a quantidade registradas.</p>}
          </div>}
          {carregandoRecursos && <p role="status">Consultando recursos elegíveis…</p>}
          {erroRecursos && <p role="alert">{erroRecursos}</p>}
          {!carregandoRecursos && !erroRecursos && !veiculos.length && <p>Nenhuma S10 elegível retornada pelo servidor.</p>}
          {!carregandoRecursos && !erroRecursos && !motoristas.length && <p>Nenhum motorista elegível retornado pelo servidor.</p>}
          <div>
            <label htmlFor="veiculo">Veículo</label>

            <Select
              id="veiculo"
              value={veiculoId}
              onChange={(event) =>
                setVeiculoId(event.target.value)
              }
              disabled={enviando || carregandoRecursos || !!erroRecursos || !ordemValida}
            >
              <option value="">
                Selecione um veículo
              </option>

              {veiculos.map((veiculo) => (
                <option
                  key={veiculo.id}
                  value={veiculo.id}
                  disabled={!veiculo.disponivel || veiculo.ocupacao >= veiculo.capacidade || !ordemValida || veiculo.ocupacao + (quantidade ?? 0) > veiculo.capacidade}
                >
                  {veiculo.modelo} - {veiculo.placa} · {veiculo.ocupacao}/{veiculo.capacidade}{!veiculo.disponivel ? ' · Indisponível' : ''}
                </option>
              ))}
            </Select>
          </div>

          {veiculoId && ocupacao.loading && <p role="status">Consultando ocupação…</p>}
          {veiculoId && ocupacao.error && <p role="alert">{ocupacao.error}</p>}
          {atual && <div><p>Ocupação atual: {atual.ocupacao}/{atual.capacidade}</p>
            {(!atual.disponivel || atual.ocupacao + (quantidade ?? 0) > atual.capacidade) && <p role="alert">Veículo indisponível ou sem capacidade para esta ordem.</p>}
          </div>}

          <div>
            <label htmlFor="motorista">Motorista</label>

            <Select
              id="motorista"
              value={motoristaId}
              onChange={(event) =>
                setMotoristaId(event.target.value)
              }
              disabled={enviando || carregandoRecursos || !!erroRecursos || !ordemValida}
            >
              <option value="">
                Selecione um motorista
              </option>

              {motoristas.map((motorista) => (
                <option
                  key={motorista.id}
                  value={motorista.id}
                >
                  {motorista.nome}
                </option>
              ))}
            </Select>
          </div>
          <p>O servidor revalida recursos e capacidade ao confirmar o despacho.</p>
          <button type="button" disabled={enviando} onClick={atualizar}>Atualizar disponibilidade</button>

          {erro && (
            <p className="svo-modal__erro" role="alert">{erro}</p>
          )}
        </div>

        {enviando && <p role="status">Confirmando despacho...</p>}
        <footer className="svo-modal__acoes">
          <button
            type="button"
            className="svo-modal__cancelar"
            onClick={onFechar}
            disabled={enviando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="svo-modal__confirmar"
            onClick={handleConfirmar}
            disabled={
              enviando || !podeConfirmar
            }
          >
            {enviando
              ? "Confirmando..."
              : "Confirmar despacho"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
