import { useCallback, useState } from 'react';
import { Link } from '../../app/routes/router';
import { ROTAS, rotaOrdemSvo, rotaSolicitacaoSvo, rotaTriagemSvo } from '../../app/routes/rotas';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { ApiError } from '../../shared/api/errors';
import { historicoSvo } from '../../shared/services/svo-ordens.service';
import {
  consultarOrdemSvo,
  consultarSolicitacaoSvo,
  consultarRecursosDisponiveisSvo,
  despacharOrdemSvo,
} from '../../shared/services/svo.service';
import { ComandoColeta, Consulta, DadosOrdem } from './ConsultaOrdemSvo';
import { PrepararDespachoModal } from './PrepararDespachoModal';
import { Pagina, Painel } from './PreviewPainel';
import { dataCivilSvo, nomeStatusSvo, estadosOrdem, estadosTriagem } from './apresentacaoSvo';

function Historico({ id, tipo }: { id: string; tipo: 'ordem' | 'solicitacao' }) {
  const [pagina, setPagina] = useState(1);
  const load = useCallback(
    (signal: AbortSignal) => historicoSvo(tipo, id, pagina, signal),
    [tipo, id, pagina],
  );
  const remoto = useRemoteData(load, null);
  return (
    <Painel titulo="Histórico">
      <Consulta remoto={remoto}>
        {({ data, meta }) => (
          <>
            {data.length ? (
              <ol className="svo-historico">
                {data.map((evento) => (
                  <li key={evento.id}>
                    <strong>{evento.descricao}</strong>
                    <p>
                      <time dateTime={evento.dataHora ?? undefined}>{dataCivilSvo(evento.dataHora)}</time> ·{' '}
                      {evento.usuarioNome ??
                        (evento.usuarioId ? '#' + evento.usuarioId : 'Responsável não informado')}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nenhum evento registrado.</p>
            )}
            {meta.total > meta.limit && (
              <div className="svo-acoes">
                <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
                  Página anterior
                </button>
                <span>
                  Página {pagina} de {Math.ceil(meta.total / meta.limit)}
                </span>
                <button disabled={pagina * meta.limit >= meta.total} onClick={() => setPagina(pagina + 1)}>
                  Próxima página
                </button>
              </div>
            )}
          </>
        )}
      </Consulta>
    </Painel>
  );
}

/** Histórico completo da ocorrência, incluindo IML e ocorrências ainda sem ordem. */
export function DetalheSolicitacao({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => consultarSolicitacaoSvo(id, signal), [id]);
  const remoto = useRemoteData(load, null);
  return (
    <Pagina
      titulo="Detalhe da solicitação"
      acao={
        <Link className="svo-atalho" para={ROTAS.svoSolicitacoes}>
          Voltar às solicitações
        </Link>
      }
    >
      <Consulta remoto={remoto}>
        {(s) => (
          <>
            <Painel titulo={s.codigo}>
              <DadosOrdem
                campos={{
                  Status: nomeStatusSvo(s.statusTriagem, estadosTriagem),
                  Recebimento: dataCivilSvo(s.criadoEm),
                  'Local do falecimento': s.localFalecimento,
                  'Endereço de remoção': s.enderecoRemocao,
                  Referência: s.pontoReferencia,
                  Solicitante: s.solicitanteNome,
                  'Observações da triagem': s.triagemObservacoes,
                  'Data da decisão': dataCivilSvo(s.triadoEm),
                }}
              />
              <div className="svo-acoes">
                <Link className="svo-atalho" para={rotaTriagemSvo(id)}>
                  {s.statusTriagem === 'AGUARDANDO_TRIAGEM' ? 'Realizar triagem' : 'Consultar triagem'}
                </Link>
                {s.ordemColeta && s.statusTriagem === 'CONFIRMADA_SVO' && (
                  <Link className="svo-atalho" para={rotaOrdemSvo(s.ordemColeta.id)}>
                    Abrir ordem {s.ordemColeta.codigo}
                  </Link>
                )}
              </div>
              {!s.ordemColeta && (
                <p>
                  {s.statusTriagem === 'ENCAMINHADA_IML'
                    ? 'Encaminhada ao IML, sem ordem de coleta SVO.'
                    : 'Sem ordem vinculada.'}
                </p>
              )}
            </Painel>
            <Historico tipo="solicitacao" id={id} />
          </>
        )}
      </Consulta>
    </Pagina>
  );
}

function DespachoDoDetalhe({
  id,
  codigo,
  fechar,
  confirmado,
  reconsultarOrdem,
}: {
  id: string;
  codigo: string;
  fechar: () => void;
  confirmado: (mensagem: string) => void;
  reconsultarOrdem: () => void;
}) {
  const recursos = useRemoteData(consultarRecursosDisponiveisSvo, null);
  async function despachar(motorista: number, veiculo: number) {
    try {
      await despacharOrdemSvo(id, motorista, veiculo);
    } catch (erro) {
      if (erro instanceof ApiError && [404, 409].includes(erro.status)) {
        recursos.retry();
        reconsultarOrdem();
      }
      throw erro;
    }
    let mensagem = 'Despacho confirmado pelo servidor.';
    try {
      await consultarRecursosDisponiveisSvo();
    } catch {
      mensagem += ' A atualização dos recursos falhou. Consulte a disponibilidade novamente.';
    }
    confirmado(mensagem);
  }
  return (
    <PrepararDespachoModal
      ordemApiId={id}
      ordemId={codigo.replace(/^#/, '')}
      motoristas={recursos.data?.motoristas ?? []}
      veiculos={recursos.data?.veiculos ?? []}
      erroRecursos={recursos.error}
      carregandoRecursos={recursos.loading}
      onAtualizarRecursos={recursos.retry}
      onConfirmar={despachar}
      onFechar={fechar}
    />
  );
}

/** Detalhe do atendente. O fluxo exclusivo do motorista usa a consulta vinculada à sessão. */
export function DetalheOrdem({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => consultarOrdemSvo(id, signal), [id]);
  const remoto = useRemoteData(load, null);
  const [despacho, setDespacho] = useState(false);
  const [aviso, setAviso] = useState({ mensagem: '', erro: false });
  function atualizar(mensagem: string, erro: boolean) {
    setAviso({ mensagem, erro });
    setDespacho(false);
    remoto.retry();
  }
  return (
    <Pagina
      titulo="Detalhe da ordem"
      acao={
        <Link className="svo-atalho" para={ROTAS.svoOrdens}>
          Voltar às ordens
        </Link>
      }
    >
      {aviso.mensagem && <p role={aviso.erro ? 'alert' : 'status'}>{aviso.mensagem}</p>}
      <Consulta remoto={remoto}>
        {(o) => (
          <>
            <Painel titulo={o.codigo}>
              <DadosOrdem
                campos={{
                  Status: nomeStatusSvo(o.status, estadosOrdem),
                  'Endereço de remoção': o.enderecoRemocao,
                  'Quantidade de corpos': o.quantidadeCorpos,
                  Motorista: o.motoristaId && '#' + o.motoristaId,
                  Veículo: o.veiculoId && '#' + o.veiculoId,
                  Início: dataCivilSvo(o.dataInicio),
                  Término: dataCivilSvo(o.dataFim),
                  'Km inicial': o.kmInicial,
                  'Km final': o.kmFinal,
                }}
              />
              <Link className="svo-atalho" para={rotaSolicitacaoSvo(o.solicitacaoId)}>
                Solicitação {o.solicitacaoCodigo} e histórico completo
              </Link>
              <div className="svo-acoes">
                {o.status === 'PENDENTE_ALOCACAO' &&
                  o.statusTriagem === 'CONFIRMADA_SVO' &&
                  o.quantidadeCorpos !== null &&
                  o.quantidadeCorpos >= 1 &&
                  o.quantidadeCorpos <= 4 && (
                    <button onClick={() => setDespacho(true)}>Preparar despacho</button>
                  )}
                {o.status && ['PENDENTE_ALOCACAO', 'EM_DESLOCAMENTO', 'EM_TRANSPORTE'].includes(o.status) && (
                  <ComandoColeta id={id} tipo="cancelar" aoTerminar={atualizar} />
                )}
              </div>
            </Painel>
            <Historico tipo="ordem" id={id} />
          </>
        )}
      </Consulta>
      {despacho && remoto.data && (
        <DespachoDoDetalhe
          id={id}
          codigo={remoto.data.codigo}
          fechar={() => setDespacho(false)}
          confirmado={(mensagem) => atualizar(mensagem, false)}
          reconsultarOrdem={remoto.retry}
        />
      )}
    </Pagina>
  );
}
