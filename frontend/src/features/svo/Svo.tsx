import { useEffect, useRef, useState } from "react";
import { DashboardSvo } from "./DashboardSvo";
import {
  NovaSolicitacaoSvo,
  type NovaSolicitacaoDados,
} from "./NovaSolicitacaoSvo";
import type { OrdemColeta } from "./AguardandoDespacho";
import type { OrdemPronta } from "./ProntasParaIniciar";
import type { AtividadeSvo } from "./AtividadeRecente";
import {
  criarSolicitacaoSvo,
  despacharOrdemSvo,
  listarMotoristasDisponiveis,
  listarOrdensAguardandoSvo,
  listarVeiculosDisponiveis,
} from "../../shared/services/svo.service";
import type {
  MotoristaApi,
  VeiculoApi,
} from "../../shared/types/svo";

type TelaSvo = "dashboard" | "nova-solicitacao";

/** Orquestra requisições canceláveis e mantém o resumo transitório da sessão existente. */
export function Svo() {
  const [telaAtual, setTelaAtual] =
    useState<TelaSvo>("dashboard");

  const [ordensAguardando, setOrdensAguardando] =
    useState<OrdemColeta[]>([]);

  const [ordensProntas, setOrdensProntas] =
    useState<OrdemPronta[]>([]);

  const [atividades, setAtividades] =
    useState<AtividadeSvo[]>([]);

  const [solicitacoesConfirmadas, setSolicitacoesConfirmadas] =
    useState(0);

  const [erroOrdens, setErroOrdens] = useState("");

  const [motoristas, setMotoristas] =
    useState<MotoristaApi[]>([]);

  const [veiculos, setVeiculos] =
    useState<VeiculoApi[]>([]);

  const request = useRef<AbortController | null>(null);
  const resources = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [carregando, setCarregando] = useState(true);
  const [erroRecursos, setErroRecursos] = useState('');
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
    const controller = new AbortController();
    resources.current = controller;
    void carregarOrdens();
    setErroRecursos('');
    void Promise.all([listarMotoristasDisponiveis(controller.signal), listarVeiculosDisponiveis(controller.signal)])
      .then(([drivers, vehicles]) => {
        if (!controller.signal.aborted) { setMotoristas(drivers); setVeiculos(vehicles); }
      }).catch(() => {
        if (!controller.signal.aborted) setErroRecursos('Não foi possível carregar os recursos para despacho. Tente novamente.');
      });
    return () => { mounted.current = false; controller.abort(); request.current?.abort(); };
  }, [tentativa]);

  function adicionarAtividade(
    titulo: string,
    descricao: string,
  ) {
    const horario = new Date().toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    setAtividades((lista) => [
      {
        id: Date.now(),
        titulo,
        descricao,
        horario,
      },
      ...lista,
    ]);
  }

  async function confirmarNovaSolicitacao(
    dados: NovaSolicitacaoDados,
  ) {
    const resultado = await criarSolicitacaoSvo(
      {
        localFalecimento: dados.localFalecimento,
        enderecoRemocao: dados.endereco,
        solicitanteNome: dados.nomeSolicitante,
        nomeFalecido: dados.nomeFalecido || undefined,
        solicitanteTelefone:
          dados.telefoneSolicitante || undefined,
      },
    );

    if (!mounted.current) return;
    setSolicitacoesConfirmadas(
      (valor) => valor + 1,
    );

    adicionarAtividade(
      "Nova solicitação confirmada",
      `${resultado.ordemColeta.codigo} criada com sucesso.`,
    );

    setTelaAtual("dashboard");

    await carregarOrdens();
  }

  async function confirmarDespacho(
    ordem: OrdemColeta,
    motoristaId: number,
    veiculoId: number,
  ) {
    await despacharOrdemSvo(
      ordem.apiId,
      motoristaId,
      veiculoId,
    );

    if (!mounted.current) return;
    resources.current?.abort();
    const motorista = motoristas.find(
      (item) => item.id === String(motoristaId),
    );

    const veiculo = veiculos.find(
      (item) => item.id === String(veiculoId),
    );

    setOrdensAguardando((ordens) =>
      ordens.filter(
        (item) => item.apiId !== ordem.apiId,
      ),
    );

    setOrdensProntas((ordens) => [
      ...ordens,
      {
        ...ordem,
        motorista:
          motorista?.nome ?? "Motorista selecionado",
        veiculo: veiculo
          ? `${veiculo.modelo} - ${veiculo.placa}`
          : "Veículo selecionado",
      },
    ]);

    setMotoristas((lista) =>
      lista.filter((item) => item.id !== String(motoristaId)),
    );

    setVeiculos((lista) =>
      lista.filter((item) => item.id !== String(veiculoId)),
    );

    adicionarAtividade(
      "Ordem despachada",
      `${ordem.id} entrou em andamento.`,
    );

    await carregarOrdens();
  }

  if (telaAtual === "nova-solicitacao") {
    return (
      <NovaSolicitacaoSvo
        onConfirmar={confirmarNovaSolicitacao}
        onVoltar={() =>
          setTelaAtual("dashboard")
        }
      />
    );
  }

  return (
    <DashboardSvo
      solicitacoesConfirmadas={
        solicitacoesConfirmadas
      }
      ordensAguardando={ordensAguardando}
      ordensProntas={ordensProntas}
      atividades={atividades}
      erroOrdens={erroOrdens || erroRecursos}
      carregando={carregando}
      onTentarNovamente={() => setTentativa(t => t + 1)}
      motoristas={motoristas}
      veiculos={veiculos}
      onNovaSolicitacao={() =>
        setTelaAtual("nova-solicitacao")
      }
      onConfirmarDespacho={confirmarDespacho}
    />
  );
}
