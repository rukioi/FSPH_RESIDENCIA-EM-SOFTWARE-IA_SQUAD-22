import { useEffect, useRef, useState } from "react";
import { DashboardSvo } from "./DashboardSvo";
import type { OrdemColeta } from "./AguardandoDespacho";
import {
  consultarOrdensSvo,
  despacharOrdemSvo,
  consultarRecursosDisponiveisSvo,
  listarOrdensAguardandoSvo,
} from "../../shared/services/svo.service";
import type { RecursosDisponiveisSvo } from "../../shared/types/svo";
import { useRemoteData } from '../../shared/api/useRemoteData';
import { ApiError } from '../../shared/api/errors';

const carregarRecentes = (signal: AbortSignal) => consultarOrdensSvo({ page: 1 }, signal);

/** Orquestra requisições canceláveis e preserva operações existentes sem produzir indicadores ou auditoria locais. */
export function Svo() {
  const [ordensAguardando, setOrdensAguardando] =
    useState<OrdemColeta[]>([]);

  const recentes = useRemoteData(carregarRecentes, null);

  const [erroOrdens, setErroOrdens] = useState("");

  const recursos = useRemoteData<RecursosDisponiveisSvo | null>(consultarRecursosDisponiveisSvo, null);
  const motoristas = recursos.data?.motoristas ?? [];
  const veiculos = recursos.data?.veiculos ?? [];

  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);

  async function carregarOrdens() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setCarregando(true);
    try {
      const ordens = await listarOrdensAguardandoSvo(controller.signal);
      if (controller.signal.aborted || !mounted.current) return;

      setOrdensAguardando(
        ordens.map((ordem) => ({
          apiId: ordem.id,
          id: `OC-${ordem.id}`,
          solicitacaoCodigo: ordem.solicitacao_codigo,
          falecido:
            ordem.nome_falecido?.trim() ||
            "Não informado",
          endereco: ordem.endereco_remocao,
          horario: "—",
        })),
      );

      setErroOrdens("");
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      setErroOrdens(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as ordens.",
      );
    } finally {
      if (!controller.signal.aborted && mounted.current) setCarregando(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void carregarOrdens();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [tentativa]);

  async function confirmarDespacho(
    ordem: OrdemColeta,
    motoristaId: number,
    veiculoId: number,
  ) {
    try {
      await despacharOrdemSvo(ordem.apiId, motoristaId, veiculoId);
    } catch(error) {
      if(mounted.current && error instanceof ApiError && [404,409].includes(error.status)) {
        recursos.retry();
        await carregarOrdens();
      }
      throw error;
    }

    if (!mounted.current) return;
    recursos.retry();
    recentes.retry();
    await carregarOrdens();
  }

  return (
    <DashboardSvo
      ordensAguardando={ordensAguardando}
      recentes={recentes}
      erroOrdens={erroOrdens}
      erroRecursos={recursos.error}
      carregandoRecursos={recursos.loading}
      onAtualizarRecursos={recursos.retry}
      carregando={carregando}
      onTentarNovamente={() => {setTentativa(t => t + 1); recursos.retry(); recentes.retry();}}
      motoristas={motoristas}
      veiculos={veiculos}
      onConfirmarDespacho={confirmarDespacho}
    />
  );
}
