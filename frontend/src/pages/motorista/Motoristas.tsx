import { useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchAutenticada } from "../../shared/services/auth.service";
import "./motoristas.css";

type HistoricoMotorista = {
  ticket?: string;
  data?: string;
  veiculo?: string;
  origem?: string;
  destino?: string;
  status?: string;
};

type PendenciaDocumental = {
  documento?: string;
  descricao?: string;
  status?: string;
  validade?: string;
};

type Motorista = {
  id?: number | string;
  nome?: string;
  codigo?: string;
  matricula?: string;
  cpf?: string;
  status?: string;
  chamadas_realizadas?: number | string;
  categoria_cnh?: string;
  cnh_categoria?: string;
  cnh?: string;
  numero_cnh?: string;
  validade_cnh?: string;
  telefone?: string;
  email?: string;
  pendencias?: number | string;
  pendencias_documentais?: PendenciaDocumental[] | string[];
  historico_chamados?: HistoricoMotorista[];
  historico_rotas?: HistoricoMotorista[];
};

type RespostaApi = {
  data?: Motorista[] | Motorista;
  error?: { message?: string };
};

type NovoMotorista = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cnh: string;
  categoria_cnh: string;
  validade_cnh: string;
  status: string;
};

const cadastroInicial: NovoMotorista = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  cnh: "",
  categoria_cnh: "A",
  validade_cnh: "",
  status: "DISPONIVEL",
};

const statusLegiveis: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_VIAGEM: "Em viagem",
  INDISPONIVEL: "Indisponível",
  AFASTADO: "Afastado",
};

function normalizar(valor?: string) {
  return (valor ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ -]/g, "_");
}

function statusLegivel(status?: string) {
  const chave = normalizar(status);
  return statusLegiveis[chave] ?? status ?? "Não informado";
}

function classeStatus(status?: string) {
  return normalizar(status).toLowerCase().replace(/_/g, "-") || "sem-status";
}

function categoriaCnh(motorista: Motorista) {
  return motorista.categoria_cnh ?? motorista.cnh_categoria ?? "Não informada";
}

function dataValidade(valor?: string) {
  if (!valor) return null;

  const data = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T00:00:00`)
    : new Date(valor);

  return Number.isNaN(data.getTime()) ? null : data;
}

function dataLegivel(valor?: string) {
  const data = dataValidade(valor);

  return data
    ? new Intl.DateTimeFormat("pt-BR").format(data)
    : valor || "Não informada";
}

function diasAteVencimento(valor?: string) {
  const validade = dataValidade(valor);
  if (!validade) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  validade.setHours(0, 0, 0, 0);

  return Math.ceil((validade.getTime() - hoje.getTime()) / 86_400_000);
}

function textoAlertaCnh(valor?: string) {
  const dias = diasAteVencimento(valor);

  if (dias === null) return "";
  if (dias < 0) return "Vencido";
  if (dias <= 30) return "Próximo do vencimento";

  return "";
}

function iniciais(nome?: string) {
  const partes = (nome ?? "Motorista").trim().split(/\s+/).filter(Boolean);

  return partes
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

function listaPendencias(motorista: Motorista): PendenciaDocumental[] {
  if (Array.isArray(motorista.pendencias_documentais)) {
    return motorista.pendencias_documentais.map((item) =>
      typeof item === "string" ? { descricao: item } : item,
    );
  }

  if (textoAlertaCnh(motorista.validade_cnh)) {
    return [
      {
        documento: "CNH",
        descricao: `Validade ${dataLegivel(motorista.validade_cnh)}`,
        status: textoAlertaCnh(motorista.validade_cnh),
      },
    ];
  }

  return [];
}

function historicoMotorista(motorista: Motorista) {
  if (Array.isArray(motorista.historico_chamados)) {
    return motorista.historico_chamados;
  }

  if (Array.isArray(motorista.historico_rotas)) {
    return motorista.historico_rotas;
  }

  return [];
}

export function Motoristas() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroDisponibilidade, setFiltroDisponibilidade] = useState("TODOS");
  const [filtroCnh, setFiltroCnh] = useState("TODOS");
  const [motoristaSelecionado, setMotoristaSelecionado] =
    useState<Motorista | null>(null);
  const [menuMotoristaAberto, setMenuMotoristaAberto] = useState<string | null>(
    null,
  );

  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [novoMotorista, setNovoMotorista] =
    useState<NovoMotorista>(cadastroInicial);

  useEffect(() => {
    const controller = new AbortController();

    async function carregarMotoristas() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetchAutenticada("/api/motoristas", {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        const resultado = (await resposta.json().catch(() => null)) as
          | RespostaApi
          | Motorista[]
          | null;

        if (!resposta.ok) {
          const mensagem =
            resultado && !Array.isArray(resultado)
              ? resultado.error?.message
              : undefined;

          throw new Error(
            mensagem ?? "Não foi possível carregar os motoristas.",
          );
        }

        const lista = Array.isArray(resultado)
          ? resultado
          : resultado && Array.isArray(resultado.data)
            ? resultado.data
            : [];

        setMotoristas(lista);
      } catch (erroBusca) {
        if (erroBusca instanceof Error && erroBusca.name === "AbortError") {
          return;
        }

        setErro(
          erroBusca instanceof Error
            ? erroBusca.message
            : "Não foi possível carregar os motoristas.",
        );
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    void carregarMotoristas();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (menuMotoristaAberto === null) return;

    const menu = document.getElementById(
      `menu-motorista-${menuMotoristaAberto}`,
    );
    const container = menu?.closest(".motorista-card__menu-wrap");

    function aoClicarFora(evento: PointerEvent) {
      if (
        evento.target instanceof Node &&
        container?.contains(evento.target)
      ) {
        return;
      }

      setMenuMotoristaAberto(null);
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;

      container
        ?.querySelector<HTMLButtonElement>(".motorista-card__mais")
        ?.focus();

      setMenuMotoristaAberto(null);
    }

    document.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("keydown", aoPressionarTecla);

    return () => {
      document.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [menuMotoristaAberto]);

  useEffect(() => {
    if (!modalCadastroAberto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !salvandoCadastro) {
        setModalCadastroAberto(false);
      }
    }

    document.addEventListener("keydown", aoPressionarTecla);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoPressionarTecla);
    };
  }, [modalCadastroAberto, salvandoCadastro]);

  async function cadastrarMotorista(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroCadastro("");
    setSalvandoCadastro(true);

    try {
      const resposta = await fetchAutenticada("/api/motoristas", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: novoMotorista.nome.trim(),
          cnh: novoMotorista.cnh.trim(),
          categoria_cnh: novoMotorista.categoria_cnh,
          validade_cnh: novoMotorista.validade_cnh,
          status: novoMotorista.status,
        }),
      });

      const resultado = (await resposta.json().catch(() => null)) as
        | RespostaApi
        | null;

      if (!resposta.ok) {
        throw new Error(
          resultado?.error?.message ??
            "Não foi possível cadastrar o motorista.",
        );
      }

      const registroApi =
        resultado?.data && !Array.isArray(resultado.data)
          ? resultado.data
          : undefined;

      const motoristaCriado: Motorista = {
        ...registroApi,
        nome: registroApi?.nome ?? novoMotorista.nome.trim(),
        cnh: registroApi?.cnh ?? novoMotorista.cnh.trim(),
        categoria_cnh:
          registroApi?.categoria_cnh ?? novoMotorista.categoria_cnh,
        validade_cnh:
          registroApi?.validade_cnh ?? novoMotorista.validade_cnh,
        status: registroApi?.status ?? novoMotorista.status,
        cpf: novoMotorista.cpf.trim() || registroApi?.cpf,
        telefone: novoMotorista.telefone.trim() || registroApi?.telefone,
        email: novoMotorista.email.trim() || registroApi?.email,
      };

      setMotoristas((atuais) => [motoristaCriado, ...atuais]);
      setNovoMotorista(cadastroInicial);
      setModalCadastroAberto(false);
    } catch (erroEnvio) {
      setErroCadastro(
        erroEnvio instanceof Error
          ? erroEnvio.message
          : "Não foi possível cadastrar o motorista.",
      );
    } finally {
      setSalvandoCadastro(false);
    }
  }

  const categorias = useMemo(
    () =>
      Array.from(
        new Set(
          motoristas
            .map(categoriaCnh)
            .filter((categoria) => categoria !== "Não informada"),
        ),
      ).sort(),
    [motoristas],
  );

  const motoristasFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return motoristas.filter((motorista) => {
      const texto = [
        motorista.nome,
        motorista.codigo,
        motorista.matricula,
        motorista.telefone,
        motorista.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      const status = normalizar(motorista.status);
      const combinaDisponibilidade =
        filtroDisponibilidade === "TODOS" ||
        status === filtroDisponibilidade;
      const combinaCnh =
        filtroCnh === "TODOS" || categoriaCnh(motorista) === filtroCnh;

      return (
        texto.includes(termo) && combinaDisponibilidade && combinaCnh
      );
    });
  }, [busca, filtroDisponibilidade, filtroCnh, motoristas]);

  const disponiveis = motoristas.filter(
    (motorista) => normalizar(motorista.status) === "DISPONIVEL",
  ).length;

  const emViagem = motoristas.filter(
    (motorista) => normalizar(motorista.status) === "EM_VIAGEM",
  ).length;

  const comAlertaCnh = motoristas.filter((motorista) => {
    const dias = diasAteVencimento(motorista.validade_cnh);
    return dias !== null && dias <= 30;
  }).length;

  if (motoristaSelecionado) {
    const motorista = motoristaSelecionado;
    const pendenciasDetalhadas = listaPendencias(motorista);
    const historico = historicoMotorista(motorista);
    const quantidadePendencias = Number(
      motorista.pendencias ?? pendenciasDetalhadas.length,
    );

    return (
      <section className="motoristas-pagina motorista-detalhe-pagina">
        <button
          type="button"
          className="motorista-voltar"
          onClick={() => setMotoristaSelecionado(null)}
        >
          <span aria-hidden="true">←</span> Motoristas
        </button>

        <section className="motorista-detalhe-painel motorista-detalhe-perfil">
          <header className="motorista-detalhe-perfil__cabecalho">
            <div>
              <h1>{motorista.nome || "Motorista"}</h1>
              <p>{motorista.email || "E-mail não informado"}</p>
            </div>

            <span
              className={`motorista-status motorista-status--${classeStatus(
                motorista.status,
              )}`}
            >
              {statusLegivel(motorista.status)}
            </span>
          </header>

          <div className="motorista-detalhe-campos">
            <div>
              <span>CPF</span>
              <strong>{motorista.cpf || "Não informado"}</strong>
            </div>
            <div>
              <span>TELEFONE</span>
              <strong>{motorista.telefone || "Não informado"}</strong>
            </div>
            <div>
              <span>E-MAIL</span>
              <strong>{motorista.email || "Não informado"}</strong>
            </div>
            <div>
              <span>CNH</span>
              <strong>
                {motorista.numero_cnh || motorista.cnh || "Não informado"}
              </strong>
            </div>
            <div>
              <span>CATEGORIA</span>
              <strong>{categoriaCnh(motorista)}</strong>
            </div>
            <div>
              <span>VALIDADE</span>
              <strong>{dataLegivel(motorista.validade_cnh)}</strong>
            </div>
            <div>
              <span>STATUS</span>
              <strong>
                <span
                  className={`motorista-status motorista-status--${classeStatus(
                    motorista.status,
                  )}`}
                >
                  {statusLegivel(motorista.status)}
                </span>
              </strong>
            </div>
            <div>
              <span>CHAMADOS REALIZADOS</span>
              <strong>
                {motorista.chamadas_realizadas ?? "Não informado"}
              </strong>
            </div>
          </div>
        </section>

        <section className="motorista-detalhe-painel">
          <header className="motorista-detalhe-secao__cabecalho">
            <h2>Pendências documentais</h2>
          </header>

          {pendenciasDetalhadas.length > 0 ? (
            <div className="motorista-pendencias-lista">
              {pendenciasDetalhadas.map((pendencia, indice) => (
                <div
                  className="motorista-pendencia-linha"
                  key={`${pendencia.documento ?? "pendencia"}-${indice}`}
                >
                  <span>
                    {[pendencia.documento, pendencia.descricao]
                      .filter(Boolean)
                      .join(" · ") || "Pendência documental"}
                  </span>

                  {(pendencia.status || pendencia.validade) && (
                    <span
                      className={`motorista-alerta ${
                        normalizar(pendencia.status).includes("VENC")
                          ? "motorista-alerta--vencido"
                          : "motorista-alerta--proximo"
                      }`}
                    >
                      {pendencia.status ||
                        `Validade ${dataLegivel(pendencia.validade)}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : quantidadePendencias > 0 ? (
            <p className="motorista-detalhe-vazio">
              A API informa {quantidadePendencias}{" "}
              {quantidadePendencias === 1 ? "pendência" : "pendências"}, mas
              não retornou a descrição documental.
            </p>
          ) : (
            <p className="motorista-detalhe-vazio">
              Nenhuma pendência documental informada pela API.
            </p>
          )}
        </section>

        <section className="motorista-detalhe-painel">
          <header className="motorista-detalhe-secao__cabecalho">
            <div>
              <h2>Histórico de chamados/rotas</h2>
              <p>Histórico operacional do motorista.</p>
            </div>
          </header>

          {historico.length > 0 ? (
            <div className="motorista-historico-tabela-wrap">
              <table className="motorista-historico-tabela">
                <thead>
                  <tr>
                    <th>TICKET</th>
                    <th>DATA</th>
                    <th>VEÍCULO</th>
                    <th>ORIGEM</th>
                    <th>DESTINO</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((registro, indice) => (
                    <tr key={`${registro.ticket ?? "registro"}-${indice}`}>
                      <td>{registro.ticket || "Não informado"}</td>
                      <td>{dataLegivel(registro.data)}</td>
                      <td>{registro.veiculo || "Não informado"}</td>
                      <td>{registro.origem || "Não informado"}</td>
                      <td>{registro.destino || "Não informado"}</td>
                      <td>
                        <span
                          className={`motorista-historico-status motorista-historico-status--${classeStatus(
                            registro.status,
                          )}`}
                        >
                          {statusLegivel(registro.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="motorista-detalhe-vazio">
              A API não retornou registros de chamados ou rotas para este
              motorista.
            </p>
          )}
        </section>
      </section>
    );
  }

  return (
    <section className="motoristas-pagina">
      <header className="motoristas-cabecalho">
        <div>
          <h1>Motoristas</h1>
          <p>
            Gerencie motoristas e acompanhe disponibilidade e documentação.
          </p>
        </div>

        <button
          className="motoristas-botao-cadastrar"
          type="button"
          onClick={() => {
            setErroCadastro("");
            setModalCadastroAberto(true);
          }}
        >
          <span aria-hidden="true">＋</span> Cadastrar motorista
        </button>
      </header>

      {modalCadastroAberto && (
        <div
          className="motorista-modal-overlay"
          onMouseDown={(evento) => {
            if (
              evento.target === evento.currentTarget &&
              !salvandoCadastro
            ) {
              setModalCadastroAberto(false);
            }
          }}
        >
          <section
            className="motorista-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="motorista-modal-titulo"
          >
            <button
              type="button"
              className="motorista-modal__fechar"
              aria-label="Fechar cadastro"
              disabled={salvandoCadastro}
              onClick={() => setModalCadastroAberto(false)}
            >
              ×
            </button>

            <h2 id="motorista-modal-titulo">Cadastrar motorista</h2>
            <p className="motorista-modal__subtitulo">
              Preencha os dados cadastrais e da habilitação.
            </p>

            <form onSubmit={cadastrarMotorista}>
              <div className="motorista-modal__grade">
                <label>
                  Nome completo
                  <input
                    required
                    value={novoMotorista.nome}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        nome: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  CPF
                  <input
                    placeholder="000.000.000-00"
                    value={novoMotorista.cpf}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        cpf: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Telefone
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={novoMotorista.telefone}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        telefone: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  E-mail
                  <input
                    type="email"
                    value={novoMotorista.email}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        email: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Número da CNH
                  <input
                    required
                    value={novoMotorista.cnh}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        cnh: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Categoria da CNH
                  <select
                    required
                    value={novoMotorista.categoria_cnh}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        categoria_cnh: evento.target.value,
                      })
                    }
                  >
                    {["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"].map(
                      (categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Validade da CNH
                  <input
                    type="date"
                    required
                    value={novoMotorista.validade_cnh}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        validade_cnh: evento.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Status
                  <select
                    value={novoMotorista.status}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        status: evento.target.value,
                      })
                    }
                  >
                    <option value="DISPONIVEL">Disponível</option>
                    <option value="EM_VIAGEM">Em viagem</option>
                    <option value="INDISPONIVEL">Indisponível</option>
                    <option value="AFASTADO">Afastado</option>
                  </select>
                </label>
              </div>

              {erroCadastro && (
                <p className="motorista-modal__erro" role="alert">
                  {erroCadastro}
                </p>
              )}

              <footer className="motorista-modal__acoes">
                <button
                  type="button"
                  className="motorista-modal__cancelar"
                  disabled={salvandoCadastro}
                  onClick={() => setModalCadastroAberto(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="motorista-modal__salvar"
                  disabled={salvandoCadastro}
                >
                  {salvandoCadastro ? "Salvando..." : "Cadastrar motorista"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      <section
        className="motoristas-indicadores"
        aria-label="Resumo dos motoristas"
      >
        <article className="motoristas-indicador">
          <div className="motoristas-indicador__topo">
            <span>Total</span>
            <span
              className="motoristas-icone motoristas-icone--azul"
              aria-hidden="true"
            >
              ♙
            </span>
          </div>
          <strong>{motoristas.length}</strong>
          <small>Motoristas cadastrados</small>
        </article>

        <article className="motoristas-indicador">
          <div className="motoristas-indicador__topo">
            <span>Disponíveis</span>
            <span
              className="motoristas-icone motoristas-icone--verde"
              aria-hidden="true"
            >
              ♧
            </span>
          </div>
          <strong>{disponiveis}</strong>
          <small>Livres para atribuição</small>
        </article>

        <article className="motoristas-indicador">
          <div className="motoristas-indicador__topo">
            <span>Em viagem</span>
            <span
              className="motoristas-icone motoristas-icone--azul"
              aria-hidden="true"
            >
              ☷
            </span>
          </div>
          <strong>{emViagem}</strong>
          <small>Em atendimento agora</small>
        </article>

        <article className="motoristas-indicador">
          <div className="motoristas-indicador__topo">
            <span>CNH com alerta</span>
            <span
              className="motoristas-icone motoristas-icone--amarelo"
              aria-hidden="true"
            >
              ⚠
            </span>
          </div>
          <strong>{comAlertaCnh}</strong>
          <small>Vencida ou próxima do vencimento</small>
        </article>
      </section>

      <div className="motoristas-filtros">
        <label className="motoristas-busca">
          <span className="motoristas-somente-leitor">
            Buscar motorista
          </span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar motorista"
          />
        </label>

        <label>
          <span className="motoristas-somente-leitor">
            Filtrar disponibilidade
          </span>
          <select
            value={filtroDisponibilidade}
            onChange={(evento) =>
              setFiltroDisponibilidade(evento.target.value)
            }
          >
            <option value="TODOS">Disponibilidade: todas</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="EM_VIAGEM">Em viagem</option>
            <option value="INDISPONIVEL">Indisponível</option>
            <option value="AFASTADO">Afastado</option>
          </select>
        </label>

        <label>
          <span className="motoristas-somente-leitor">
            Filtrar categoria CNH
          </span>
          <select
            value={filtroCnh}
            onChange={(evento) => setFiltroCnh(evento.target.value)}
          >
            <option value="TODOS">Categoria CNH: todas</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </label>

        <span className="motoristas-resultado">
          {motoristasFiltrados.length} de {motoristas.length} motoristas
        </span>
      </div>

      {erro && (
        <p className="motoristas-aviso motoristas-aviso--erro" role="alert">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="motoristas-aviso">Carregando motoristas...</p>
      )}

      {!carregando && !erro && motoristasFiltrados.length === 0 && (
        <div className="motoristas-vazio">
          Nenhum motorista encontrado para os filtros selecionados.
        </div>
      )}

      {!carregando && motoristasFiltrados.length > 0 && (
        <div className="motoristas-grade">
          {motoristasFiltrados.map((motorista, indice) => {
            const chave =
              motorista.id ??
              motorista.codigo ??
              motorista.matricula ??
              `${motorista.nome ?? "motorista"}-${indice}`;
            const chaveMenu = String(chave);
            const alertaCnh = textoAlertaCnh(motorista.validade_cnh);
            const identificador = motorista.codigo ?? motorista.matricula;
            const chamadas = motorista.chamadas_realizadas ?? 0;
            const quantidadePendencias = Number(
              motorista.pendencias ?? listaPendencias(motorista).length,
            );

            return (
              <article className="motorista-card" key={chave}>
                <div className="motorista-card__topo">
                  <span className="motorista-avatar" aria-hidden="true">
                    {iniciais(motorista.nome)}
                  </span>
                  <span
                    className={`motorista-status motorista-status--${classeStatus(
                      motorista.status,
                    )}`}
                  >
                    {statusLegivel(motorista.status)}
                  </span>
                </div>

                <h2>{motorista.nome || "Motorista"}</h2>

                <p className="motorista-card__subtitulo">
                  {identificador ? `${identificador} · ` : ""}
                  Ativo · {chamadas} chamados realizados
                </p>

                <div className="motorista-cnh">
                  <div>
                    <span>Categoria CNH</span>
                    <strong>{categoriaCnh(motorista)}</strong>
                  </div>
                  <div>
                    <span>Validade CNH</span>
                    <strong
                      className={alertaCnh ? "motorista-texto-alerta" : ""}
                    >
                      {dataLegivel(motorista.validade_cnh)}
                    </strong>
                  </div>
                  {alertaCnh && (
                    <span
                      className={`motorista-alerta motorista-alerta--${
                        alertaCnh === "Vencido" ? "vencido" : "proximo"
                      }`}
                    >
                      {alertaCnh}
                    </span>
                  )}
                </div>

                <div className="motorista-contato">
                  <span className="motorista-contato__item">
                    <svg
                      className="motorista-contato__icone"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M7 3h3l2 5-2.5 1.5a14 14 0 0 0 5 5L16 12l5 2v3c0 1.1-.9 2-2 2C10.6 19 5 13.4 5 6c0-1.7.9-3 2-3Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>
                      {motorista.telefone || "Telefone não informado"}
                    </span>
                  </span>

                  <span className="motorista-contato__item">
                    <svg
                      className="motorista-contato__icone"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="m4 7 8 6 8-6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{motorista.email || "E-mail não informado"}</span>
                  </span>

                  <span className="motorista-contato__pendencias">
                    {quantidadePendencias}{" "}
                    {quantidadePendencias === 1
                      ? "pendência"
                      : "pendências"}
                  </span>
                </div>

                <div className="motorista-card__acoes">
                  <button
                    type="button"
                    className="motorista-detalhes-botao"
                    onClick={() => {
                      setMenuMotoristaAberto(null);
                      setMotoristaSelecionado(motorista);
                    }}
                  >
                    Ver detalhes
                    <span
                      className="motorista-detalhes-botao__seta"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </button>

                  <div className="motorista-card__menu-wrap">
                    <button
                      type="button"
                      className="motorista-card__mais"
                      aria-label={`Mais opções para ${
                        motorista.nome || "motorista"
                      }`}
                      aria-haspopup="menu"
                      aria-expanded={menuMotoristaAberto === chaveMenu}
                      aria-controls={`menu-motorista-${chaveMenu}`}
                      onClick={() =>
                        setMenuMotoristaAberto((atual) =>
                          atual === chaveMenu ? null : chaveMenu,
                        )
                      }
                    >
                      <span aria-hidden="true">•••</span>
                    </button>

                    {menuMotoristaAberto === chaveMenu && (
                      <div
                        className="motorista-card__menu"
                        id={`menu-motorista-${chaveMenu}`}
                        role="menu"
                        aria-label={`Opções para ${
                          motorista.nome || "motorista"
                        }`}
                      >
                        <button
                          type="button"
                          className="motorista-card__menu-item"
                          role="menuitem"
                          onClick={() => setMenuMotoristaAberto(null)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="m16 5 3 3M4 20l4.5-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          className="motorista-card__menu-item motorista-card__menu-item--remover"
                          role="menuitem"
                          onClick={() => setMenuMotoristaAberto(null)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>Remover</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
