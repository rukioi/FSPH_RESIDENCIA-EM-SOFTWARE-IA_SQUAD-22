import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./Veiculos.css";

type RegistroAbastecimento = {
  data?: string;
  quilometragem?: number | string;
  litros?: number | string;
  valor?: number | string;
  comprovante?: string;
};

type RegistroManutencao = {
  servico?: string;
  tipo?: string;
  entrada?: string;
  previsao?: string;
  conclusao?: string;
  custo?: number | string;
  status?: string;
};

type RegistroQuilometragem = {
  data?: string;
  viagem?: string;
  motorista?: string;
  km_inicial?: number | string;
  km_final?: number | string;
  percorrido?: number | string;
};

type RegistroMulta = {
  data?: string;
  descricao?: string;
  valor?: number | string;
  orgao?: string;
  situacao?: string;
};

type RegistroOperacional = {
  ticket?: string;
  data?: string;
  origem?: string;
  destino?: string;
  motorista?: string;
  status?: string;
};

type Veiculo = {
  id?: number | string;
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: number | string;
  tipo?: string;
  capacidade_obitos?: number | string;
  quilometragem_atual?: number | string;
  status?: string;
  is_svo?: boolean;

  propriedade?: string;
  fornecedor_locacao?: string;
  seguro_vencimento?: string;
  documentacao_regular?: boolean;

  origem?: string;
  utilizacao?: string;
  ultima_utilizacao?: string;

  abastecimentos?: RegistroAbastecimento[];
  historico_manutencao?: RegistroManutencao[];
  historico_quilometragem?: RegistroQuilometragem[];
  multas?: RegistroMulta[];
  historico_operacional?: RegistroOperacional[];
};

type RespostaApi = {
  data?: Veiculo | Veiculo[];
  error?: {
    message?: string;
  };
};

type FormularioVeiculo = {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  tipo: string;
  capacidade_obitos: string;
  quilometragem_atual: string;
  status: string;
  is_svo: boolean;
};

const formularioInicial: FormularioVeiculo = {
  placa: "",
  marca: "",
  modelo: "",
  ano: "",
  tipo: "PASSEIO",
  capacidade_obitos: "",
  quilometragem_atual: "",
  status: "DISPONIVEL",
  is_svo: false,
};

const nomesStatus: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_VIAGEM: "Em viagem",
  EM_MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
};

function normalizarStatus(status?: string) {
  return (status ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ -]/g, "_");
}

function formatarStatus(status?: string) {
  const chave = normalizarStatus(status);
  return nomesStatus[chave] ?? status ?? "Não informado";
}

function classeStatus(status?: string) {
  return normalizarStatus(status).toLowerCase().replace(/_/g, "-");
}

function formatarQuilometragem(valor?: number | string) {
  if (valor === undefined || valor === null || valor === "") {
    return "Não informada";
  }

  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return `${valor} km`;
  }

  return `${new Intl.NumberFormat("pt-BR").format(numero)} km`;
}

function exibirCampo(valor?: string | number | null) {
  if (valor === undefined || valor === null || valor === "") {
    return "Não informado";
  }

  return String(valor);
}

function DetalheTabela({
  titulo,
  cabecalhos,
  linhas,
}: {
  titulo: string;
  cabecalhos: string[];
  linhas: (string | number | undefined)[][];
}) {
  return (
    <article className="veiculo-detalhe__painel">
      <header className="veiculo-detalhe__secao-cabecalho">
        <h2>{titulo}</h2>
      </header>

      <div className="veiculo-detalhe__tabela-wrap">
        <table>
          <thead>
            <tr>
              {cabecalhos.map((cabecalho) => (
                <th key={cabecalho}>{cabecalho}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={`${titulo}-${indice}`}>
                {linha.map((valor, coluna) => (
                  <td key={`${titulo}-${indice}-${coluna}`}>
                    {exibirCampo(valor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {!linhas.length && (
          <p className="veiculo-detalhe__vazio">
            Nenhum registro retornado pela API.
          </p>
        )}
      </div>
    </article>
  );
}

function DetalhesVeiculo({
  veiculo,
  aoVoltar,
}: {
  veiculo: Veiculo;
  aoVoltar: () => void;
}) {
  const abastecimentos = veiculo.abastecimentos ?? [];
  const manutencoes = veiculo.historico_manutencao ?? [];
  const quilometragens = veiculo.historico_quilometragem ?? [];
  const multas = veiculo.multas ?? [];
  const operacoes = veiculo.historico_operacional ?? [];

  const categoria = veiculo.is_svo ? "SVO" : "Administrativo";

  const documentacao =
    veiculo.documentacao_regular === undefined
      ? "Não informada"
      : veiculo.documentacao_regular
        ? "Regular"
        : "Pendente";

  const campos: [string, string][] = [
    ["Placa", exibirCampo(veiculo.placa)],
    ["Modelo", exibirCampo(veiculo.modelo)],
    [
      "Marca / ano",
      `${exibirCampo(veiculo.marca)} · ${exibirCampo(veiculo.ano)}`,
    ],
    ["Fornecedor de locação", exibirCampo(veiculo.fornecedor_locacao)],
    ["Origem", exibirCampo(veiculo.origem ?? veiculo.propriedade)],
    ["Utilização", exibirCampo(veiculo.utilizacao ?? categoria)],
    ["Capacidade", exibirCampo(veiculo.capacidade_obitos)],
    ["Situação atual", formatarStatus(veiculo.status)],
    [
      "Quilometragem atual",
      formatarQuilometragem(veiculo.quilometragem_atual),
    ],
    ["Última utilização", exibirCampo(veiculo.ultima_utilizacao)],
    ["Documentação", documentacao],
  ];

  return (
    <section className="veiculo-detalhe">
      <button
        className="veiculo-detalhe__voltar"
        type="button"
        onClick={aoVoltar}
      >
        ‹ Veículos
      </button>

      <article className="veiculo-detalhe__painel">
        <header className="veiculo-detalhe__cabecalho">
          <div>
            <h1>
              {exibirCampo(veiculo.placa)} · {categoria}
            </h1>
            <p>
              {exibirCampo(veiculo.modelo)} ·{" "}
              {exibirCampo(veiculo.propriedade ?? veiculo.origem)} · {categoria}
            </p>
          </div>

          <div className="veiculo-detalhe__acoes">
            <span
              className={`veiculo-status veiculo-status--${classeStatus(
                veiculo.status,
              )}`}
            >
              {formatarStatus(veiculo.status)}
            </span>

            <button
              type="button"
              disabled
              title="Edição não configurada nesta tela"
            >
              Editar veículo
            </button>
          </div>
        </header>

        <div className="veiculo-detalhe__campos">
          {campos.map(([rotulo, valor]) => (
            <div className="veiculo-detalhe__campo" key={rotulo}>
              <span>{rotulo}</span>
              <strong>{valor}</strong>
            </div>
          ))}
        </div>
      </article>

      <div className="veiculo-detalhe__duas-colunas">
        <article className="veiculo-detalhe__painel">
          <header className="veiculo-detalhe__secao-cabecalho">
            <h2>Manutenção</h2>
            <button type="button" disabled title="Ação não configurada">
              Enviar para manutenção
            </button>
          </header>

          <p className="veiculo-detalhe__vazio">
            {manutencoes.length
              ? `${manutencoes.length} registro(s) de manutenção. Consulte o histórico abaixo.`
              : "Nenhuma manutenção registrada pela API para este veículo."}
          </p>
        </article>

        <article className="veiculo-detalhe__painel">
          <header className="veiculo-detalhe__secao-cabecalho">
            <div>
              <h2>Abastecimento</h2>
              <small>{abastecimentos.length} registro(s)</small>
            </div>

            <button type="button" disabled title="Ação não configurada">
              Registrar abastecimento
            </button>
          </header>

          <div className="veiculo-detalhe__tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Quilometragem</th>
                  <th>Litros</th>
                  <th>Valor</th>
                  <th>Comprovante</th>
                </tr>
              </thead>

              <tbody>
                {abastecimentos.map((item, indice) => (
                  <tr key={`${item.data ?? "abastecimento"}-${indice}`}>
                    <td>{exibirCampo(item.data)}</td>
                    <td>{formatarQuilometragem(item.quilometragem)}</td>
                    <td>{exibirCampo(item.litros)}</td>
                    <td>{exibirCampo(item.valor)}</td>
                    <td>{exibirCampo(item.comprovante)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!abastecimentos.length && (
              <p className="veiculo-detalhe__vazio">
                Nenhum abastecimento retornado pela API.
              </p>
            )}
          </div>
        </article>
      </div>

      <DetalheTabela
        titulo="Histórico de manutenção"
        cabecalhos={[
          "Serviço",
          "Tipo",
          "Entrada",
          "Previsão",
          "Conclusão",
          "Custo",
          "Status",
        ]}
        linhas={manutencoes.map((item) => [
          item.servico,
          item.tipo,
          item.entrada,
          item.previsao,
          item.conclusao,
          item.custo,
          item.status,
        ])}
      />

      <DetalheTabela
        titulo="Histórico de quilometragem"
        cabecalhos={[
          "Data",
          "Viagem",
          "Motorista",
          "KM inicial",
          "KM final",
          "Percorrido",
        ]}
        linhas={quilometragens.map((item) => [
          item.data,
          item.viagem,
          item.motorista,
          item.km_inicial,
          item.km_final,
          item.percorrido,
        ])}
      />

      <DetalheTabela
        titulo="Multas e infrações"
        cabecalhos={["Data", "Descrição", "Valor", "Órgão", "Situação"]}
        linhas={multas.map((item) => [
          item.data,
          item.descricao,
          item.valor,
          item.orgao,
          item.situacao,
        ])}
      />

      <article className="veiculo-detalhe__painel">
        <header className="veiculo-detalhe__secao-cabecalho">
          <div>
            <h2>Histórico operacional</h2>
            <small>Chamados e rotas realizados por este veículo.</small>
          </div>
        </header>

        <div className="veiculo-detalhe__tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Data</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Motorista</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {operacoes.map((item, indice) => (
                <tr key={`${item.ticket ?? "operacao"}-${indice}`}>
                  <td>{exibirCampo(item.ticket)}</td>
                  <td>{exibirCampo(item.data)}</td>
                  <td>{exibirCampo(item.origem)}</td>
                  <td>{exibirCampo(item.destino)}</td>
                  <td>{exibirCampo(item.motorista)}</td>
                  <td>{exibirCampo(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!operacoes.length && (
            <p className="veiculo-detalhe__vazio">
              Nenhum registro operacional retornado pela API.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

export function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroSvo, setFiltroSvo] = useState("TODOS");
  const [veiculoSelecionado, setVeiculoSelecionado] =
    useState<Veiculo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioVeiculo>(formularioInicial);

  useEffect(() => {
    const controller = new AbortController();

    async function carregarVeiculos() {
      try {
        setCarregando(true);
        setErro("");

        const token = localStorage.getItem("token");

        const resposta = await fetch("/api/veiculos", {
          signal: controller.signal,
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
        });

        const resultado = (await resposta.json()) as RespostaApi;

        if (!resposta.ok) {
          throw new Error(
            resultado.error?.message ??
              "Não foi possível carregar os veículos.",
          );
        }

        setVeiculos(Array.isArray(resultado.data) ? resultado.data : []);
      } catch (erroBusca) {
        if (erroBusca instanceof Error && erroBusca.name === "AbortError") {
          return;
        }

        setErro(
          erroBusca instanceof Error
            ? erroBusca.message
            : "Não foi possível carregar os veículos.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    void carregarVeiculos();

    return () => controller.abort();
  }, []);

  const tiposVeiculo = useMemo(
    () =>
      Array.from(
        new Set(
          veiculos
            .map((veiculo) => veiculo.tipo)
            .filter((tipo): tipo is string => Boolean(tipo)),
        ),
      ).sort(),
    [veiculos],
  );

  const veiculosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return veiculos.filter((veiculo) => {
      const textoBusca = [
        veiculo.placa,
        veiculo.marca,
        veiculo.modelo,
        veiculo.tipo,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      const combinaBusca = textoBusca.includes(termo);

      const combinaStatus =
        filtroStatus === "TODOS" ||
        normalizarStatus(veiculo.status) === filtroStatus;

      const combinaTipo =
        filtroTipo === "TODOS" || veiculo.tipo === filtroTipo;

      const combinaSvo =
        filtroSvo === "TODOS" ||
        (filtroSvo === "SVO" && veiculo.is_svo === true) ||
        (filtroSvo === "ADMINISTRATIVO" && veiculo.is_svo !== true);

      return combinaBusca && combinaStatus && combinaTipo && combinaSvo;
    });
  }, [busca, filtroSvo, filtroStatus, filtroTipo, veiculos]);

  const totalDisponiveis = veiculos.filter(
    (veiculo) => normalizarStatus(veiculo.status) === "DISPONIVEL",
  ).length;

  const totalEmViagem = veiculos.filter(
    (veiculo) => normalizarStatus(veiculo.status) === "EM_VIAGEM",
  ).length;

  const totalEmManutencao = veiculos.filter(
    (veiculo) => normalizarStatus(veiculo.status) === "EM_MANUTENCAO",
  ).length;

  const totalIndisponiveis = veiculos.filter(
    (veiculo) => normalizarStatus(veiculo.status) === "INDISPONIVEL",
  ).length;

  function atualizarCampo<K extends keyof FormularioVeiculo>(
    campo: K,
    valor: FormularioVeiculo[K],
  ) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  async function cadastrarVeiculo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");

    try {
      setSalvando(true);

      const token = localStorage.getItem("token");

      const resposta = await fetch("/api/veiculos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          placa: formulario.placa.trim().toUpperCase(),
          marca: formulario.marca.trim(),
          modelo: formulario.modelo.trim(),
          ano: Number(formulario.ano),
          tipo: formulario.tipo,
          capacidade_obitos: Number(formulario.capacidade_obitos || 0),
          quilometragem_atual: Number(formulario.quilometragem_atual || 0),
          status: formulario.status,
          is_svo: formulario.is_svo,
        }),
      });

      const resultado = (await resposta.json()) as RespostaApi;

      if (!resposta.ok) {
        throw new Error(
          resultado.error?.message ?? "Não foi possível cadastrar o veículo.",
        );
      }

      const novoVeiculo = resultado.data;

      if (novoVeiculo && !Array.isArray(novoVeiculo)) {
        setVeiculos((atuais) => [novoVeiculo, ...atuais]);
      }

      setFormulario(formularioInicial);
      setModalAberto(false);
    } catch (erroCadastro) {
      setErro(
        erroCadastro instanceof Error
          ? erroCadastro.message
          : "Não foi possível cadastrar o veículo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (veiculoSelecionado) {
    return (
      <DetalhesVeiculo
        veiculo={veiculoSelecionado}
        aoVoltar={() => setVeiculoSelecionado(null)}
      />
    );
  }

  return (
    <section className="veiculos-pagina">
      <header className="veiculos-cabecalho">
        <div>
          <h1>Veículos</h1>
          <p>Gerencie e acompanhe a situação da frota.</p>
        </div>

        <button
          className="veiculos-botao-cadastrar"
          type="button"
          onClick={() => {
            setErro("");
            setModalAberto(true);
          }}
        >
          <span aria-hidden="true">＋</span>
          Cadastrar veículo
        </button>
      </header>

      <section className="veiculos-indicadores" aria-label="Resumo da frota">
        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Total</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--azul">
              ▣
            </span>
          </div>
          <strong>{veiculos.length}</strong>
          <small>{totalIndisponiveis} indisponíveis</small>
        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Disponíveis</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--verde">
              ✓
            </span>
          </div>
          <strong>{totalDisponiveis}</strong>
          <small>Prontos para atendimento</small>
        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Em viagem</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--azul">
              ⇄
            </span>
          </div>
          <strong>{totalEmViagem}</strong>
          <small>Em atendimento agora</small>
        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Em manutenção</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--amarelo">
              🔧
            </span>
          </div>
          <strong>{totalEmManutencao}</strong>
          <small>Fora de operação temporária</small>
        </article>
      </section>

      <div className="veiculos-filtros">
        <label className="veiculos-busca">
          <span className="veiculos-somente-leitor">
            Buscar por placa ou modelo
          </span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar placa ou modelo"
          />
        </label>

        <label>
          <span className="veiculos-somente-leitor">
            Filtrar por status
          </span>
          <select
            value={filtroStatus}
            onChange={(evento) => setFiltroStatus(evento.target.value)}
          >
            <option value="TODOS">Todos os status</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="EM_VIAGEM">Em viagem</option>
            <option value="EM_MANUTENCAO">Em manutenção</option>
            <option value="INDISPONIVEL">Indisponível</option>
          </select>
        </label>

        <label>
          <span className="veiculos-somente-leitor">Filtrar por tipo</span>
          <select
            value={filtroTipo}
            onChange={(evento) => setFiltroTipo(evento.target.value)}
          >
            <option value="TODOS">Todos os tipos</option>
            {tiposVeiculo.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="veiculos-somente-leitor">
            Filtrar por categoria
          </span>
          <select
            value={filtroSvo}
            onChange={(evento) => setFiltroSvo(evento.target.value)}
          >
            <option value="TODOS">Todas as categorias</option>
            <option value="ADMINISTRATIVO">Administrativo</option>
            <option value="SVO">SVO</option>
          </select>
        </label>

        <span className="veiculos-resultado">
          {veiculosFiltrados.length} de {veiculos.length} veículos
        </span>
      </div>

      {erro && !modalAberto && (
        <p className="veiculos-aviso veiculos-aviso--erro" role="alert">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="veiculos-aviso">Carregando veículos...</p>
      )}

      {!carregando && !erro && veiculosFiltrados.length === 0 && (
        <div className="veiculos-vazio">
          Nenhum veículo encontrado para os filtros selecionados.
        </div>
      )}

      {!carregando && veiculosFiltrados.length > 0 && (
        <div className="veiculos-grade">
          {veiculosFiltrados.map((veiculo, indice) => {
            const chave =
              veiculo.id ?? `${veiculo.placa ?? "veiculo"}-${indice}`;

            return (
              <article className="veiculo-card" key={chave}>
                <div className="veiculo-card__topo">
                  <span className="veiculo-card__icone" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 11.5 6.5 7a2 2 0 0 1 1.9-1.4h7.2A2 2 0 0 1 17.5 7l1.5 4.5 1.2.4a1.2 1.2 0 0 1 .8 1.1V17h-2.2" />
                      <path d="M5.2 17H3v-4a1.2 1.2 0 0 1 .8-1.1l1.2-.4M5 11.5h14M8 17h8" />
                      <circle cx="6.5" cy="16.5" r="1.8" />
                      <circle cx="17.5" cy="16.5" r="1.8" />
                    </svg>
                  </span>

                  <span
                    className={`veiculo-status veiculo-status--${classeStatus(
                      veiculo.status,
                    )}`}
                    title={`Status: ${formatarStatus(veiculo.status)}`}
                  >
                    {formatarStatus(veiculo.status)}
                  </span>
                </div>

                <h2>
                  {[veiculo.marca, veiculo.modelo]
                    .filter(Boolean)
                    .join(" ") || "Veículo"}
                </h2>

                <p className="veiculo-card__placa">
                  {veiculo.placa || "Placa não informada"}
                </p>

                <div className="veiculo-card__marcadores">
                  {veiculo.propriedade && (
                    <span className="veiculo-tag">
                      {veiculo.propriedade}
                    </span>
                  )}

                  {veiculo.tipo && (
                    <span className="veiculo-tag veiculo-tag--azul">
                      {veiculo.tipo}
                    </span>
                  )}

                  {veiculo.is_svo && (
                    <span className="veiculo-tag veiculo-tag--azul">SVO</span>
                  )}

                  {veiculo.ano && (
                    <span className="veiculo-card__ano">{veiculo.ano}</span>
                  )}
                </div>

                <div className="veiculo-card__dados">
                  <div className="veiculo-card__linha">
                    <span>Quilometragem</span>
                    <strong>
                      {formatarQuilometragem(veiculo.quilometragem_atual)}
                    </strong>
                  </div>

                  <div className="veiculo-card__linha veiculo-card__linha--coluna">
                    <span>Fornecedor de locação</span>
                    <strong>
                      {exibirCampo(veiculo.fornecedor_locacao)}
                    </strong>
                  </div>

                  {veiculo.seguro_vencimento && (
                    <p className="veiculo-card__alerta">
                      ⚠ Seguro próximo do vencimento
                    </p>
                  )}

                  {veiculo.documentacao_regular !== undefined && (
                    <p
                      className={
                        veiculo.documentacao_regular
                          ? "veiculo-card__documento"
                          : "veiculo-card__alerta"
                      }
                    >
                      {veiculo.documentacao_regular
                        ? "✓ Documentação regular"
                        : "⚠ Documentação pendente"}
                    </p>
                  )}
                </div>

                <button
                  className="veiculo-card__detalhes-botao"
                  type="button"
                  onClick={() => setVeiculoSelecionado(veiculo)}
                >
                  Ver detalhes
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div className="veiculos-modal-fundo">
          <section
            className="veiculos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="veiculos-modal-titulo"
          >
            <div className="veiculos-modal__cabecalho">
              <div>
                <h2 id="veiculos-modal-titulo">Cadastrar veículo</h2>
                <p>Preencha os dados principais da frota.</p>
              </div>

              <button
                type="button"
                className="veiculos-modal__fechar"
                aria-label="Fechar"
                onClick={() => setModalAberto(false)}
              >
                ×
              </button>
            </div>

            <form
              className="veiculos-formulario"
              onSubmit={cadastrarVeiculo}
            >
              <label>
                Placa
                <input
                  required
                  value={formulario.placa}
                  onChange={(evento) =>
                    atualizarCampo("placa", evento.target.value)
                  }
                />
              </label>

              <label>
                Marca
                <input
                  required
                  value={formulario.marca}
                  onChange={(evento) =>
                    atualizarCampo("marca", evento.target.value)
                  }
                />
              </label>

              <label>
                Modelo
                <input
                  required
                  value={formulario.modelo}
                  onChange={(evento) =>
                    atualizarCampo("modelo", evento.target.value)
                  }
                />
              </label>

              <label>
                Ano
                <input
                  required
                  type="number"
                  min="1900"
                  max="2100"
                  value={formulario.ano}
                  onChange={(evento) =>
                    atualizarCampo("ano", evento.target.value)
                  }
                />
              </label>

              <label>
                Tipo
                <input
                  value={formulario.tipo}
                  onChange={(evento) =>
                    atualizarCampo("tipo", evento.target.value)
                  }
                />
              </label>

              <label>
                Capacidade
                <input
                  type="number"
                  min="0"
                  value={formulario.capacidade_obitos}
                  onChange={(evento) =>
                    atualizarCampo("capacidade_obitos", evento.target.value)
                  }
                />
              </label>

              <label>
                Quilometragem
                <input
                  type="number"
                  min="0"
                  value={formulario.quilometragem_atual}
                  onChange={(evento) =>
                    atualizarCampo("quilometragem_atual", evento.target.value)
                  }
                />
              </label>

              <label>
                Status
                <select
                  value={formulario.status}
                  onChange={(evento) =>
                    atualizarCampo("status", evento.target.value)
                  }
                >
                  <option value="DISPONIVEL">Disponível</option>
                  <option value="EM_VIAGEM">Em viagem</option>
                  <option value="EM_MANUTENCAO">Em manutenção</option>
                  <option value="INDISPONIVEL">Indisponível</option>
                </select>
              </label>

              <label className="veiculos-formulario__checkbox">
                <input
                  type="checkbox"
                  checked={formulario.is_svo}
                  onChange={(evento) =>
                    atualizarCampo("is_svo", evento.target.checked)
                  }
                />
                Veículo da categoria SVO
              </label>

              {erro && (
                <p className="veiculos-aviso veiculos-aviso--erro" role="alert">
                  {erro}
                </p>
              )}

              <div className="veiculos-formulario__acoes">
                <button
                  type="button"
                  className="veiculos-botao-secundario"
                  onClick={() => setModalAberto(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="veiculos-botao-cadastrar"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Salvar veículo"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

