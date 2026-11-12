import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../shared/api/errors';
import { alterarColeta, type AcaoColeta } from '../../shared/services/svo-ordens.service';

/** Mantém dados antigos fora da tela durante uma nova consulta ou uma falha. */
export function Consulta<T>({
  remoto,
  children,
}: {
  remoto: { loading: boolean; error: string; data: T | null; retry: () => void };
  children: (data: T) => ReactNode;
}) {
  if (remoto.loading) return <p role="status">Consultando…</p>;
  if (remoto.error)
    return (
      <div className="svo-acoes">
        <p role="alert">{remoto.error}</p>
        <button onClick={remoto.retry}>Tentar novamente</button>
      </div>
    );
  return remoto.data === null ? null : children(remoto.data);
}

export function DadosOrdem({ campos }: { campos: Record<string, string | number | null> }) {
  return (
    <dl className="svo-campos">
      {Object.entries(campos).map(([nome, valor]) => (
        <div key={nome}>
          <dt>{nome}</dt>
          <dd>{valor ?? 'Não informado'}</dd>
        </div>
      ))}
    </dl>
  );
}

const rotulos = {
  iniciar: 'Iniciar execução',
  etapa: 'Iniciar transporte',
  concluir: 'Concluir ordem',
  cancelar: 'Cancelar ordem',
};

/** Confirma uma ação explícita; falhas exigem releitura e nunca repetem o PATCH automaticamente. */
export function ComandoColeta({
  id,
  tipo,
  minimo = 0,
  aoTerminar,
}: {
  id: string;
  tipo: AcaoColeta['tipo'];
  minimo?: number;
  aoTerminar: (mensagem: string, erro: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ocupado = useRef(false);
  const ativo = useRef(true);
  const [km, setKm] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);
  const precisaKm = tipo === 'iniciar' || tipo === 'concluir';
  const valido = !precisaKm || (/^\d+$/.test(km) && Number.isSafeInteger(Number(km)) && Number(km) >= minimo);
  async function confirmar() {
    if (!valido || ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    try {
      await alterarColeta(
        id,
        tipo === 'iniciar' || tipo === 'concluir' ? { tipo, km: Number(km) } : { tipo },
      );
      if (ativo.current) aoTerminar('Alteração confirmada pelo servidor.', false);
    } catch (error) {
      const mensagem =
        error instanceof ApiError
          ? `${error.status ? 'Erro ' + error.status + ': ' : ''}${error.message}`
          : 'Não foi possível confirmar a alteração.';
      if (ativo.current) aoTerminar(mensagem, true);
    } finally {
      ocupado.current = false;
      if (ativo.current) {
        dialog.current?.close();
        setEnviando(false);
      }
    }
  }
  return (
    <div className="svo-acoes">
      {precisaKm && (
        <label className="svo-campo">
          {tipo === 'iniciar' ? 'Quilometragem inicial' : 'Quilometragem final'}
          <input
            type="number"
            inputMode="numeric"
            min={minimo}
            step="1"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
          {tipo === 'concluir' && <small>Mínimo: {minimo} km</small>}
        </label>
      )}
      <button disabled={!valido || enviando} onClick={() => dialog.current?.showModal()}>
        {rotulos[tipo]}
      </button>
      <dialog
        ref={dialog}
        className="svo-confirmacao"
        aria-labelledby="comando-ordem"
        onCancel={(e) => {
          if (ocupado.current) e.preventDefault();
        }}
      >
        <h2 id="comando-ordem">{rotulos[tipo]}?</h2>
        <p>
          Ordem #OC-{id}
          {precisaKm ? ` · ${km} km` : ''}
        </p>
        <div className="svo-acoes">
          <button disabled={enviando} onClick={() => dialog.current?.close()}>
            Voltar
          </button>
          <button disabled={enviando} onClick={confirmar}>
            Confirmar
          </button>
        </div>
        {enviando && <p role="status">Salvando…</p>}
      </dialog>
    </div>
  );
}
