import { DatePicker } from '../../shared/components/DatePicker';
import { Select } from '../../shared/components/Select';
import { IconeGestor } from '../../shared/components/IconeGestor'
import { StatusMotorista } from '../../features/motoristas/StatusMotorista'
import { useConsultaMotorista } from '../../features/motoristas/useConsultaMotorista';
import { MotoristaDisponibilidade } from '../../features/motoristas/MotoristaDisponibilidade';
import { BotaoMotorista, DialogMotorista } from '../../features/motoristas/DialogMotorista';
import { navegar } from '../../app/routes/router';
import { ROTAS, rotaMotorista } from '../../app/routes/rotas';
import { obterToken } from '../../shared/services/auth.service';
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { buscarMotoristas, cadastrarMotorista as salvarMotorista, editarMotorista as atualizarMotorista, removerMotorista as excluirMotorista } from "../../shared/services/motoristas.service";
import type { MotoristaDto, CriarMotoristaDto } from "../../shared/services/motoristas.service";
import "./Motoristas.css";
import '../../shared/styles/cartao-identidade.css';

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

// Modelo visual; os campos de transporte vêm do contrato gerado.
type Motorista = MotoristaDto & {
  codigo?: string; matricula?: string; chamadas_realizadas?: number | string;
  cnh_categoria?: string; numero_cnh?: string; email?: string | null; pendencias?: number | string;
  pendencias_documentais?: PendenciaDocumental[] | string[];
  historico_chamados?: HistoricoMotorista[]; historico_rotas?: HistoricoMotorista[];
};

// Novo: cadastro com e-mail do usuário MOTORISTA a ser vinculado.
type CriarMotoristaComEmail = CriarMotoristaDto & { email?: string | null };

type StatusFormularioMotorista = NonNullable<CriarMotoristaDto['status']>;

type NovoMotorista = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  cnh: string;
  categoria_cnh: CriarMotoristaDto['categoria_cnh'] | '';
  validade_cnh: string;
  status: StatusFormularioMotorista;
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
  FOLGA: "Folga",
  AFASTADO: "Afastado",
};

function normalizar(valor?: string | null) {
  return (valor ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ -]/g, "_");
}

function statusLegivel(status?: string | null) {
  const chave = normalizar(status);
  return statusLegiveis[chave] ?? status ?? "Não informado";
}

function classeStatus(status?: string | null) {
  return normalizar(status).toLowerCase().replace(/_/g, "-") || "sem-status";
}

function categoriaCnh(motorista: Motorista) {
  return motorista.categoria_cnh ?? motorista.cnh_categoria ?? "Não informada";
}

function formatarDataInput(valor?: string | null) {
  if (!valor) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toISOString().slice(0, 10);
}

function motoristaParaFormulario(motorista: Motorista): NovoMotorista {
  const statusNormalizado = normalizar(motorista.status);
  const statusValido: StatusFormularioMotorista =
    statusNormalizado === "DISPONIVEL" ||
    statusNormalizado === "EM_VIAGEM" ||
    statusNormalizado === "FOLGA" ||
    statusNormalizado === "AFASTADO"
      ? statusNormalizado
      : "DISPONIVEL";

  return {
    nome: motorista.nome ?? "",
    cpf: motorista.cpf ?? "",
    telefone: motorista.telefone ?? "",
    email: motorista.email ?? "",
    cnh: motorista.numero_cnh ?? motorista.cnh ?? "",
    categoria_cnh: categoriaCnh(motorista) !== "Não informada" ? categoriaCnh(motorista) : "A",
    validade_cnh: formatarDataInput(motorista.validade_cnh),
    status: statusValido,
  };
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

/** Separa a consulta validada da seleção, dos filtros e do cadastro confirmado. */
export function Motoristas({ motoristaId, perfil = '' }: { motoristaId?: string; perfil?: string }) {
  if (!['ADM', 'GESTOR_FROTA'].includes(perfil)) return <p role="alert">Seu perfil não tem acesso à gestão de motoristas.</p>;
  return <MotoristasConteudo key={`${obterToken() ?? 'sem-sessao'}:${motoristaId ?? 'lista'}`} {...(motoristaId ? { motoristaId } : {})} perfil={perfil} />;
}

function MotoristasConteudo({ motoristaId, perfil }: { motoristaId?: string; perfil: string }) {
  const { data: registros, carregando, erro, atualizar: retry } = useConsultaMotorista(buscarMotoristas);
  const motoristas: Motorista[] = registros ?? [];
  const vivo = useRef(false);
  const enviando = useRef(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState("");
  const [filtroDisponibilidade, setFiltroDisponibilidade] = useState("TODOS");
  const [filtroCnh, setFiltroCnh] = useState("TODOS");
  const [motoristaSelecionado, setMotoristaSelecionado] =
    useState<Motorista | null>(null);
  const [motoristaEmEdicao, setMotoristaEmEdicao] =
    useState<Motorista | null>(null);
  const [menuMotoristaAberto, setMenuMotoristaAberto] = useState<string | null>(
    null,
  );
  const [confirmacaoRemocao, setConfirmacaoRemocao] = useState<{ motorista: Motorista; etapa: 1 | 2 } | null>(null);
  const [removendoMotorista, setRemovendoMotorista] = useState(false);
  const [erroRemocao, setErroRemocao] = useState('');

  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");
  const [novoMotorista, setNovoMotorista] =
    useState<NovoMotorista>(cadastroInicial);

  const editando = motoristaEmEdicao !== null;

  function abrirCadastro() {
    setMotoristaEmEdicao(null);
    setNovoMotorista(cadastroInicial);
    setErroCadastro("");
    setModalCadastroAberto(true);
  }

  function abrirEdicao(motorista: Motorista) {
    setMenuMotoristaAberto(null);
    setMotoristaEmEdicao(motorista);
    setNovoMotorista(motoristaParaFormulario(motorista));
    setErroCadastro("");
    setModalCadastroAberto(true);
  }

  function fecharModalCadastro() {
    if (salvandoCadastro) return;
    setModalCadastroAberto(false);
    setMotoristaEmEdicao(null);
    setErroCadastro("");
  }

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
        fecharModalCadastro();
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
    if (enviando.current) return;
    if (!novoMotorista.nome.trim() || !novoMotorista.cnh.trim()) { setErroCadastro('Nome e CNH são obrigatórios e não podem conter somente espaços.'); return; }
    if (!novoMotorista.categoria_cnh) { setErroCadastro('Selecione uma categoria de CNH aceita pelo contrato.'); return; }
    setErroCadastro("");
    enviando.current = true;
    setSalvandoCadastro(true);
    const token = obterToken();

    try {
      const emailLimpo = novoMotorista.email.trim().toLowerCase() || null;
      const cpfLimpo = novoMotorista.cpf.trim() || null;
      const telefoneLimpo = novoMotorista.telefone.trim() || null;
      const statusSeguro: StatusFormularioMotorista = novoMotorista.status ?? "DISPONIVEL";

      if (motoristaEmEdicao) {
        const atualizado: Motorista = {
          ...motoristaEmEdicao,
          nome: novoMotorista.nome.trim(),
          cpf: cpfLimpo,
          telefone: telefoneLimpo,
          email: emailLimpo,
          cnh: novoMotorista.cnh.trim(),
          numero_cnh: novoMotorista.cnh.trim(),
          categoria_cnh: novoMotorista.categoria_cnh as CriarMotoristaDto['categoria_cnh'],
          cnh_categoria: novoMotorista.categoria_cnh,
          validade_cnh: novoMotorista.validade_cnh,
          status: statusSeguro,
        };

        setMotoristas((atuais) =>
          atuais.map((item) =>
            item.id === motoristaEmEdicao.id ? atualizado : item,
          ),
        );
        if (motoristaSelecionado?.id === motoristaEmEdicao.id) {
          setMotoristaSelecionado(atualizado);
        }
        setAviso(
          emailLimpo
            ? `Dados de ${atualizado.nome} atualizados e vinculados a ${emailLimpo}.`
            : `Dados de ${atualizado.nome} atualizados.`,
        );
        setNovoMotorista(cadastroInicial);
        setMotoristaEmEdicao(null);
        setModalCadastroAberto(false);
        return;
      }

      // Novo: o e-mail vai junto para o backend vincular o usuário MOTORISTA.
      const entrada: CriarMotoristaComEmail = {
        nome: novoMotorista.nome.trim(),
        cnh: novoMotorista.cnh.trim(),
        categoria_cnh: novoMotorista.categoria_cnh as CriarMotoristaDto['categoria_cnh'],
        validade_cnh: novoMotorista.validade_cnh,
        status: statusSeguro,
        cpf: cpfLimpo,
        telefone: telefoneLimpo,
        email: emailLimpo,
      };
      const motoristaCriado = await salvarMotorista(entrada);
      setMotoristas((atuais) => [motoristaCriado, ...atuais]);
      setAviso(
        entrada.email
          ? `Motorista cadastrado e vinculado ao acesso ${entrada.email}.`
          : 'Motorista cadastrado com sucesso.',
      );
      setNovoMotorista(cadastroInicial);
      setModalCadastroAberto(false);
      setMotoristaEmEdicao(null);
    } catch (erroEnvio) {
      if (!vivo.current || obterToken() !== token) return;
      setErroCadastro(
        erroEnvio instanceof Error
          ? erroEnvio.message
          : editando
            ? "Não foi possível atualizar o motorista."
            : "Não foi possível cadastrar o motorista.",
      );
    } finally {
      enviando.current = false;
      if (vivo.current && obterToken() === token) setSalvandoCadastro(false);
    }
  }

  async function removerMotoristaSelecionado() {
    if (!confirmacaoRemocao || confirmacaoRemocao.etapa !== 2 || removendoMotorista) return;
    if (enviando.current) return;
    enviando.current = true;
    const token = obterToken();
    setRemovendoMotorista(true);
    setErroRemocao('');
    try {
      await excluirMotorista(confirmacaoRemocao.motorista.id);
      setMotoristas(atuais => atuais.filter(item => item.id !== confirmacaoRemocao.motorista.id));
      if (motoristaSelecionado?.id === confirmacaoRemocao.motorista.id) {
        setMotoristaSelecionado(null);
      }
      setAviso(`Motorista ${confirmacaoRemocao.motorista.nome} removido com sucesso.`);
      setConfirmacaoRemocao(null);
    } catch (erroEnvio) {
      if (!vivo.current || obterToken() !== token) return;
      setErroRemocao(erroEnvio instanceof Error ? erroEnvio.message : 'Não foi possível remover o motorista.');
    } finally {
      enviando.current = false;
      if (vivo.current && obterToken() === token) setRemovendoMotorista(false);
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

  if (motoristaId && erro) return <p role="alert" className="motoristas-aviso motoristas-aviso--erro">{erro} <BotaoMotorista onClick={retry}>Tentar novamente</BotaoMotorista><BotaoMotorista onClick={() => navegar(ROTAS.motoristasGestor)}>Motoristas</BotaoMotorista></p>;
  if (motoristaId && !motoristaSelecionado) {
    return carregando ? <p role="status">Carregando motorista…</p> : <div><h1>Motorista não encontrado</h1><p role="alert">O motorista não foi encontrado na consulta permitida ao seu perfil.</p><BotaoMotorista onClick={() => navegar(ROTAS.motoristasGestor)}>Motoristas</BotaoMotorista></div>;
  }

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
          onClick={() => navegar(ROTAS.motoristasGestor)}
        >
          <span aria-hidden="true">←</span> Motoristas
        </button>

        {carregando && <p role="status">Atualizando cadastro do motorista…</p>}
        <section className="motorista-detalhe-painel motorista-detalhe-perfil cartao-identidade">
          <header className="cartao-identidade__principal">
            <span className="cartao-identidade__avatar" aria-hidden="true">{iniciais(motorista.nome)}</span>
            <div>
              <h1>{motorista.nome || "Motorista"}</h1>
              <p>{motorista.email || "E-mail não informado"}</p>
            </div>

            <StatusMotorista motoristaId={motorista.id} status={motorista.status} legivel={statusLegivel} classe={classeStatus} />
          </header>

          <div className="motorista-detalhe-campos cartao-identidade__conteudo">
            <div>
              <span>CPF</span>
              <strong>{motorista.cpf || "Não informado"}</strong>
            </div>
            <div>
              <span>TELEFONE</span>
              <strong>{motorista.telefone || "Não informado"}</strong>
            </div>
            <div>
              <span>E-MAIL DE ACESSO</span>
              <strong>{motorista.email || "Sem acesso vinculado"}</strong>
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

        <MotoristaDisponibilidade motorista={motorista} perfil={perfil} onAtualizarCadastro={retry} />

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
              Histórico de chamados e rotas indisponível nesta tela.
            </p>
          )}
        </section>
      </section>
    );
  }

  return (
    <section className="motoristas-pagina">
      {confirmacaoRemocao && (
        <DialogMotorista rotulo="motorista-remocao-titulo" descricao="motorista-remocao-descricao" ocupado={removendoMotorista} onFechar={() => setConfirmacaoRemocao(null)}>
          <section className="motorista-remocao-dialog">
            <h2 id="motorista-remocao-titulo">{confirmacaoRemocao.etapa === 1 ? 'Confirmar remoção' : 'Confirmação final'}</h2>
            <p id="motorista-remocao-descricao">{confirmacaoRemocao.etapa === 1 ? `Deseja iniciar a remoção de ${confirmacaoRemocao.motorista.nome}?` : `Esta ação removerá ${confirmacaoRemocao.motorista.nome} do cadastro. Deseja concluir?`}</p>
            {erroRemocao && <p role="alert">{erroRemocao}</p>}
            <div className="motorista-remocao-acoes">
              <button type="button" disabled={removendoMotorista} onClick={() => { setConfirmacaoRemocao(null); setErroRemocao(''); }}>Cancelar</button>
              {confirmacaoRemocao.etapa === 1 ? (
                <button type="button" onClick={() => setConfirmacaoRemocao({ ...confirmacaoRemocao, etapa: 2 })}>Continuar</button>
              ) : (
                <button type="button" disabled={removendoMotorista} onClick={removerMotoristaSelecionado}>{removendoMotorista ? 'Removendo...' : 'Remover definitivamente'}</button>
              )}
            </div>
          </section>
        </DialogMotorista>
      )}
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
          onClick={abrirCadastro}
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
              fecharModalCadastro();
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
              aria-label={editando ? "Fechar edição" : "Fechar cadastro"}
              disabled={salvandoCadastro}
              onClick={fecharModalCadastro}
            >
              ×
            </button>

            <h2 id="motorista-modal-titulo">
              {editando ? "Editar motorista" : "Cadastrar motorista"}
            </h2>
            <p className="motorista-modal__subtitulo">
              {editando
                ? "Atualize os dados cadastrais e da habilitação."
                : "Preencha os dados cadastrais e da habilitação."}
            </p>

            <form onSubmit={cadastrarMotorista}>
              <fieldset disabled={salvandoCadastro} className="motorista-modal__grade md-fieldset">
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

                {/* Novo: e-mail do usuário MOTORISTA que terá acesso às viagens */}
                <label>
                  E-mail de acesso (opcional)
                  <input
                    type="email"
                    placeholder="motorista@frota.gov.br"
                    autoComplete="off"
                    value={novoMotorista.email}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        email: evento.target.value,
                      })
                    }
                  />
                  <small>Precisa ser um usuário com perfil Motorista.</small>
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
                  <Select
                    required
                    value={novoMotorista.categoria_cnh}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        categoria_cnh: ["A", "B", "C", "D", "E"].includes(evento.target.value) ? evento.target.value as CriarMotoristaDto["categoria_cnh"] : "",
                      })
                    }
                  >
                    <option value="" disabled>Selecione a categoria</option>
                    {["A", "B", "C", "D", "E"].map(
                      (categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ),
                    )}
                  </Select>
                </label>

                <label>
                  Validade da CNH
                  <DatePicker
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
                  <Select
                    value={novoMotorista.status}
                    onChange={(evento) =>
                      setNovoMotorista({
                        ...novoMotorista,
                        status: evento.target.value as StatusFormularioMotorista,
                      })
                    }
                  >
                    <option value="">Não informado</option>
                    <option value="DISPONIVEL">Disponível</option>
                    <option value="EM_VIAGEM">Em viagem</option>
                    <option value="FOLGA">Folga</option>
                    <option value="AFASTADO">Afastado</option>
                  </Select>
                </label>
              </fieldset>

              {salvandoCadastro && (
                <p role="status">
                  {editando ? "Salvando alterações..." : "Salvando motorista..."}
                </p>
              )}
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
                  onClick={fecharModalCadastro}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="motorista-modal__salvar"
                  disabled={salvandoCadastro}
                >
                  {salvandoCadastro
                    ? "Salvando..."
                    : editando
                      ? "Salvar alterações"
                      : "Cadastrar motorista"}
                </button>
              </footer>
            </form>
          </section>
        </DialogMotorista>
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
              <IconeGestor nome="motoristas" tamanho={18} />
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
              <IconeGestor nome="confirmado" tamanho={18} />
            </span>
          </div>
          <strong>{disponiveis}</strong>
          <small>Status operacional disponível</small>
        </article>

        <article className="motoristas-indicador">
          <div className="motoristas-indicador__topo">
            <span>Em viagem</span>
            <span
              className="motoristas-icone motoristas-icone--azul"
              aria-hidden="true"
            >
              <IconeGestor nome="rota" tamanho={18} />
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
              <IconeGestor nome="alerta" tamanho={18} />
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
          <span aria-hidden="true"><IconeGestor nome="busca" tamanho={18} /></span>
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
          <Select
            value={filtroDisponibilidade}
            onChange={(evento) =>
              setFiltroDisponibilidade(evento.target.value)
            }
          >
            <option value="TODOS">Disponibilidade: todas</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="EM_VIAGEM">Em viagem</option>
            <option value="FOLGA">Folga</option>
            <option value="AFASTADO">Afastado</option>
          </Select>
        </label>

        <label>
          <span className="motoristas-somente-leitor">
            Filtrar categoria CNH
          </span>
          <Select
            value={filtroCnh}
            onChange={(evento) => setFiltroCnh(evento.target.value)}
          >
            <option value="TODOS">Categoria CNH: todas</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </Select>
        </label>

        {(busca || filtroDisponibilidade !== "TODOS" || filtroCnh !== "TODOS") && (
          <button type="button" className="motoristas-limpar" onClick={() => { setBusca(""); setFiltroDisponibilidade("TODOS"); setFiltroCnh("TODOS"); }}>Limpar filtros</button>
        )}
        <span className="motoristas-resultado">
          {motoristasFiltrados.length} de {motoristas.length} motoristas
        </span>
      </div>

      {erro && (
        <p className="motoristas-aviso motoristas-aviso--erro" role="alert">
          {erro} <button type="button" onClick={retry}>Tentar novamente</button>
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}

      {carregando && (
        <p className="motoristas-aviso" role="status">Carregando motoristas...</p>
      )}

      {!carregando && !erro && motoristasFiltrados.length === 0 && (
        <div className="motoristas-vazio">
          Nenhum motorista encontrado para os filtros selecionados.
        </div>
      )}

      {!carregando && !erro && motoristasFiltrados.length > 0 && (
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
            const chamadas = motorista.chamadas_realizadas;
            const quantidadePendencias = Number(
              motorista.pendencias ?? listaPendencias(motorista).length,
            );

            return (
              <article className={`motorista-card motorista-card--${classeStatus(motorista.status)}`} key={chave}>
                <div className="motorista-card__topo">
                  <span className="motorista-avatar" aria-hidden="true">
                    {iniciais(motorista.nome)}
                  </span>
                  <StatusMotorista motoristaId={motorista.id} status={motorista.status} legivel={statusLegivel} classe={classeStatus} />
                </div>

                <h2>{motorista.nome || "Motorista"}</h2>

                <p className="motorista-card__subtitulo">
                  {identificador ? `${identificador} · ` : ""}
                  {chamadas === undefined ? 'Histórico de chamados indisponível' : `${chamadas} chamados realizados`}
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
                    <span>{motorista.email || "Sem acesso vinculado"}</span>
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
                      navegar(rotaMotorista(motorista.id));
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

                  <div className="motorista-card__menu-wrap" onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget)) setMenuMotoristaAberto(null); }}>
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
                          onClick={() => abrirEdicao(motorista)}
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
                          onClick={() => {
                            setMenuMotoristaAberto(null);
                            setErroRemocao('');
                            setConfirmacaoRemocao({ motorista, etapa: 1 });
                          }}
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
                        <button type="button" className="motorista-card__menu-item" role="menuitem" onClick={() => { setMenuMotoristaAberto(null); navegar(rotaMotorista(motorista.id)); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 15h2M14 15h2" /></svg>
                          Escalas e situação profissional
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