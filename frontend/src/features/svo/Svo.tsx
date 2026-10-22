import { useRef, useState } from "react";
import { DashboardSvo } from "./DashboardSvo";
import {
  NovaSolicitacaoSvo,
  type NovaSolicitacaoDados,
} from "./NovaSolicitacaoSvo";
import type { OrdemColeta } from "./AguardandoDespacho";
import type { OrdemPronta } from "./ProntasParaIniciar";
import type { AtividadeSvo } from "./AtividadeRecente";

type TelaSvo = "dashboard" | "nova-solicitacao";

const ordensAguardandoIniciais: OrdemColeta[] = [
  {
    id: "OC-1001",
    falecido: "José da Silva",
    endereco: "Rua das Flores, 120",
    horario: "10:30",
  },
  {
    id: "OC-1002",
    falecido: "Maria de Souza",
    endereco: "Av. Central, 450",
    horario: "11:15",
  },
  {
    id: "OC-1003",
    falecido: "Antônio Santos",
    endereco: "Rua São José, 88",
    horario: "13:40",
  },
];

const ordensProntasIniciais: OrdemPronta[] = [
  {
    id: "OC-0999",
    falecido: "João Oliveira",
    endereco: "Rua A, 100",
    horario: "08:30",
    veiculo: "Veículo 01 - ABC1D23",
    motorista: "Carlos Silva",
  },
  {
    id: "OC-1000",
    falecido: "Ana Costa",
    endereco: "Av. B, 250",
    horario: "09:15",
    veiculo: "Veículo 02 - DEF4G56",
    motorista: "Marcos Santos",
  },
];

const atividadesIniciais: AtividadeSvo[] = [
  {
    id: 1,
    titulo: "Ordem preparada para despacho",
    descricao: "OC-1000 atribuída ao motorista Marcos Santos.",
    horario: "09:15",
  },
  {
    id: 2,
    titulo: "Nova solicitação confirmada",
    descricao: "OC-1003 criada para Antônio Santos.",
    horario: "13:40",
  },
  {
    id: 3,
    titulo: "Nova solicitação confirmada",
    descricao: "OC-1002 criada para Maria de Souza.",
    horario: "11:15",
  },
];

export function Svo() {
  const [telaAtual, setTelaAtual] =
    useState<TelaSvo>("dashboard");

  const [solicitacoesConfirmadas, setSolicitacoesConfirmadas] =
    useState(8);

  const [ordensAguardando, setOrdensAguardando] =
    useState<OrdemColeta[]>(ordensAguardandoIniciais);

  const [ordensProntas, setOrdensProntas] =
    useState<OrdemPronta[]>(ordensProntasIniciais);

  const [atividades, setAtividades] =
    useState<AtividadeSvo[]>(atividadesIniciais);

  const proximaOrdem = useRef(1004);
  const proximaAtividade = useRef(4);

  function horarioAtual() {
    return new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function adicionarAtividade(
    titulo: string,
    descricao: string,
  ) {
    const novaAtividade: AtividadeSvo = {
      id: proximaAtividade.current,
      titulo,
      descricao,
      horario: horarioAtual(),
    };

    proximaAtividade.current += 1;

    setAtividades((lista) =>
      [novaAtividade, ...lista].slice(0, 6),
    );
  }

  function confirmarNovaSolicitacao(
    dados: NovaSolicitacaoDados,
  ) {
    const numeroOrdem = proximaOrdem.current;
    proximaOrdem.current += 1;

    const novaOrdem: OrdemColeta = {
      id: `OC-${numeroOrdem}`,
      falecido: dados.nomeFalecido,
      endereco: dados.endereco,
      horario: horarioAtual(),
    };

    setOrdensAguardando((ordens) => [
      ...ordens,
      novaOrdem,
    ]);

    setSolicitacoesConfirmadas((valor) => valor + 1);

    adicionarAtividade(
      "Nova solicitação confirmada",
      `${novaOrdem.id} criada para ${dados.nomeFalecido}.`,
    );

    setTelaAtual("dashboard");
  }

  function confirmarDespacho(
    ordem: OrdemColeta,
    veiculo: string,
    motorista: string,
  ) {
    setOrdensAguardando((ordens) =>
      ordens.filter((item) => item.id !== ordem.id),
    );

    setOrdensProntas((ordens) => [
      ...ordens,
      {
        ...ordem,
        veiculo,
        motorista,
      },
    ]);

    adicionarAtividade(
      "Ordem preparada para despacho",
      `${ordem.id} atribuída ao motorista ${motorista}.`,
    );
  }

  if (telaAtual === "nova-solicitacao") {
    return (
      <NovaSolicitacaoSvo
        onConfirmar={confirmarNovaSolicitacao}
        onVoltar={() => setTelaAtual("dashboard")}
      />
    );
  }

  return (
    <DashboardSvo
      solicitacoesConfirmadas={solicitacoesConfirmadas}
      ordensAguardando={ordensAguardando}
      ordensProntas={ordensProntas}
      atividades={atividades}
      onNovaSolicitacao={() =>
        setTelaAtual("nova-solicitacao")
      }
      onConfirmarDespacho={confirmarDespacho}
    />
  );
}
