import { useEffect, useState } from "react";
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

  function obterToken() {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Token de autenticação não encontrado.",
      );
    }

    return token;
  }

  async function carregarOrdens() {
    try {
      const token = obterToken();
      const ordens = await listarOrdensAguardandoSvo(token);

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
      setErroOrdens(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as ordens.",
      );
    }
  }

  useEffect(() => {
    void carregarOrdens();

    Promise.all([
      listarMotoristasDisponiveis().then(setMotoristas),
      listarVeiculosDisponiveis().then(setVeiculos),
    ]).catch((erro) => {
      console.error(
        "Erro ao carregar dados do SVO:",
        erro,
      );
    });
  }, []);

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
    const token = obterToken();

    const resultado = await criarSolicitacaoSvo(
      {
        localFalecimento: dados.localFalecimento,
        enderecoRemocao: dados.endereco,
        solicitanteNome: dados.nomeSolicitante,
        nomeFalecido: dados.nomeFalecido || undefined,
        solicitanteTelefone:
          dados.telefoneSolicitante || undefined,
      },
      token,
    );

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
    const token = obterToken();

    await despacharOrdemSvo(
      ordem.apiId,
      motoristaId,
      veiculoId,
      token,
    );

    const motorista = motoristas.find(
      (item) => item.id === motoristaId,
    );

    const veiculo = veiculos.find(
      (item) => item.id === veiculoId,
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
      lista.filter((item) => item.id !== motoristaId),
    );

    setVeiculos((lista) =>
      lista.filter((item) => item.id !== veiculoId),
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
      erroOrdens={erroOrdens}
      motoristas={motoristas}
      veiculos={veiculos}
      onNovaSolicitacao={() =>
        setTelaAtual("nova-solicitacao")
      }
      onConfirmarDespacho={confirmarDespacho}
    />
  );
}
