import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../app/routes/router';
import { ROTAS, rotaExecucaoOrdemSvo } from '../../app/routes/rotas';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { minhasOrdens, minhaOrdem, proximaEtapa } from '../../shared/services/svo-ordens.service';
import { Consulta, ComandoColeta, DadosOrdem } from './ConsultaOrdemSvo';
import { Pagina, Painel } from './PreviewPainel';
import { dataCivilSvo, estadosOrdem } from './apresentacaoSvo';
import './PreviewSvo.css';

/** Lista exclusiva da equipe, retornada pelo endpoint autorizado do motorista. */
export function MinhasOrdensSvo() {
  const remoto = useRemoteData(minhasOrdens, null);
  return (
    <Pagina
      titulo="Minhas Ordens"
      acao={
        <button className="svo-atalho" onClick={remoto.retry}>
          Atualizar ordens
        </button>
      }
    >
      <Consulta remoto={remoto}>
        {({ data }) =>
          data.length ? (
            <>
              {data.map((o) => (
                <Painel key={o.id} titulo={o.codigo}>
                  <p>
                    {estadosOrdem[o.status]} · {o.solicitacaoCodigo}
                  </p>
                  <p>{o.enderecoRemocao}</p>
                  {o.dataInicio && <p>Início: {dataCivilSvo(o.dataInicio)}</p>}
                  <Link className="svo-atalho" para={rotaExecucaoOrdemSvo(o.id)}>
                    Abrir execução {o.codigo}
                  </Link>
                </Painel>
              ))}
              {data.length === 100 && <p>Exibindo as 100 ordens mais recentes.</p>}
            </>
          ) : (
            <p>Nenhuma ordem atribuída a você.</p>
          )
        }
      </Consulta>
    </Pagina>
  );
}

/** Recupera o detalhe mínimo autorizado e reconsulta a ordem após cada tentativa de transição. */
export function ExecucaoSvo({ id, motorista }: { id: string; motorista: string }) {
  const load = useCallback((signal: AbortSignal) => minhaOrdem(id, signal), [id]);
  const remoto = useRemoteData(load, null);
  const [aviso, setAviso] = useState({ mensagem: '', erro: false });
  const [revisao, setRevisao] = useState(0);
  const [erroLista, setErroLista] = useState(false);
  useEffect(() => {
    if (!revisao) return;
    const controller = new AbortController();
    setErroLista(false);
    void minhasOrdens(controller.signal).catch(() => {
      if (!controller.signal.aborted) setErroLista(true);
    });
    return () => controller.abort();
  }, [revisao]);
  function atualizar(mensagem: string, erro: boolean) {
    setAviso({ mensagem, erro });
    remoto.retry();
    setRevisao((valor) => valor + 1);
  }
  return (
    <Pagina
      titulo="Execução da ordem"
      acao={
        <Link className="svo-atalho" para={ROTAS.svoMinhasOrdens}>
          Voltar a Minhas Ordens
        </Link>
      }
    >
      {erroLista && (
        <p role="alert">Não foi possível atualizar a lista. Abra Minhas Ordens para consultar novamente.</p>
      )}
      {aviso.mensagem && <p role={aviso.erro ? 'alert' : 'status'}>{aviso.mensagem}</p>}
      <Consulta remoto={remoto}>
        {(o) => {
          const etapa = proximaEtapa(o);
          return (
            <Painel titulo={o.codigo}>
              <DadosOrdem
                campos={{
                  Solicitação: o.solicitacaoCodigo,
                  Status: estadosOrdem[o.status],
                  'Endereço de remoção': o.enderecoRemocao,
                  Motorista: motorista,
                  Veículo: o.veiculoId && '#' + o.veiculoId,
                  'Quantidade de corpos': o.quantidadeCorpos,
                  Início: dataCivilSvo(o.dataInicio),
                  Término: dataCivilSvo(o.dataFim),
                  'Km inicial': o.kmInicial,
                  'Km final': o.kmFinal,
                }}
              />
              {etapa && (
                <ComandoColeta
                  key={etapa}
                  id={id}
                  tipo={etapa}
                  minimo={etapa === 'concluir' ? (o.kmInicial ?? 0) : 0}
                  aoTerminar={atualizar}
                />
              )}
            </Painel>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
