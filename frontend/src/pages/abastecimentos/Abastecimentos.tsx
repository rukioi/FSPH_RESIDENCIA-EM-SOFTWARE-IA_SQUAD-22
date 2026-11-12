import { DatePicker } from "../../shared/components/DatePicker";
import { Select } from "../../shared/components/Select";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRemoteData } from "../../shared/api/useRemoteData";
import { errorMessage } from "../../shared/api/errors";
import {
  buscarAbastecimentos,
  registrarAbastecimento,
  baixarComprovanteAbastecimento,
} from "../../shared/services/abastecimentos.service";
import { buscarVeiculos } from "../../shared/services/veiculos.service";
import { buscarMotoristas } from "../../shared/services/motoristas.service";
import { IconeGestor } from "../../shared/components/IconeGestor";
import "./Abastecimentos.css";
import { Link } from "../../app/routes/router";
import {
  ROTAS,
  rotaDetalheAbastecimento,
  rotaHistoricoAbastecimentosVeiculo,
} from "../../app/routes/rotas";

const carregar = async (signal: AbortSignal) => {
  const [registros, veiculos, motoristas] = await Promise.all([
    buscarAbastecimentos(signal),
    buscarVeiculos(signal),
    buscarMotoristas(signal),
  ]);
  return { registros, veiculos, motoristas };
};
type Dados = Awaited<ReturnType<typeof carregar>>;
const vazio: Dados = { registros: [], veiculos: [], motoristas: [] };
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Apresenta registros validados e aguarda confirmação da API para cadastrar. */
export function Abastecimentos() {
  const remoto = useRemoteData(carregar, vazio);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [erroDownload, setErroDownload] = useState("");
  const montado = useRef(false);
  const download = useRef<AbortController | null>(null);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      download.current?.abort();
    };
  }, []);
  const dialogo = useRef<HTMLDialogElement>(null);
  const abrir = useRef<HTMLButtonElement>(null);

  const registros = useMemo(
    () =>
      remoto.data.registros
        .filter((item) => {
          const data = item.data_abastecimento.slice(0, 10);

          return (
            (!inicio || data >= inicio) &&
            (!fim || data <= fim) &&
            (!veiculo || item.veiculo_id === veiculo)
          );
        })
        .sort((a, b) =>
          b.data_abastecimento.localeCompare(a.data_abastecimento),
        ),
    [remoto.data.registros, inicio, fim, veiculo],
  );

  const [pagina, setPagina] = useState(1);
  const porPagina = 10;
  const totalPaginas = Math.max(1, Math.ceil(registros.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const registrosPagina = registros.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina,
  );

  const litros = registros.reduce(
    (total, item) => total + Number(item.litragem),
    0,
  );
  const valor = registros.reduce(
    (total, item) => total + Number(item.valor_total),
    0,
  );

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const campos = new FormData(form);
    const arquivo = campos.get("comprovante");
    if (
      arquivo instanceof File &&
      arquivo.size &&
      (!["image/jpeg", "image/png"].includes(arquivo.type) ||
        arquivo.size > 1024 * 1024)
    ) {
      setErro("Selecione uma imagem JPEG ou PNG de até 1 MiB.");
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      let comprovante:
        | {
            nome: string;
            tipo: "image/jpeg" | "image/png";
            dadosBase64: string;
          }
        | undefined;
      if (arquivo instanceof File && arquivo.size) {
        const bytes = new Uint8Array(await arquivo.arrayBuffer());
        let binario = "";
        for (const byte of bytes) binario += String.fromCharCode(byte);
        comprovante = {
          nome: arquivo.name,
          tipo: arquivo.type as "image/jpeg" | "image/png",
          dadosBase64: btoa(binario),
        };
      }
      if (!montado.current) return;
      await registrarAbastecimento({
        veiculo_id: String(campos.get("veiculo")),
        motorista_id: String(campos.get("motorista")),
        posto: String(campos.get("posto") ?? "").trim() || null,
        data_abastecimento: String(campos.get("data")),
        quilometragem: Number(campos.get("quilometragem")),
        litragem: String(campos.get("litros")),
        valor_total: String(campos.get("valor")),
        tanque_completo: campos.has("tanque"),
        comprovante,
      });
      if (!montado.current) return;
      remoto.setData((dados) => dados);
      remoto.retry();
      form.reset();
      dialogo.current?.close();
      setAviso("Abastecimento registrado com sucesso.");
      abrir.current?.focus();
    } catch (falha) {
      if (montado.current) setErro(errorMessage(falha));
    } finally {
      if (montado.current) setSalvando(false);
    }
  }

  async function baixar(id: string, nome: string) {
    download.current?.abort();
    const controller = new AbortController();
    download.current = controller;
    setErroDownload("");
    try {
      const blob = await baixarComprovanteAbastecimento(id, controller.signal);
      if (controller.signal.aborted || !montado.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch (falha) {
      if (!controller.signal.aborted && montado.current)
        setErroDownload(errorMessage(falha));
    } finally {
      if (download.current === controller) download.current = null;
    }
  }

  return (
    <section className="abastecimentos">
      <header className="abastecimentos__cabecalho">
        <div>
          <h1>Abastecimentos</h1>
          <p>Registre e acompanhe os abastecimentos da frota.</p>
        </div>
        <Link
          para={ROTAS.indicadoresAbastecimentosGestor}
          className="abastecimentos__download"
        >
          Ver indicadores
        </Link>
        <button
          ref={abrir}
          className="abastecimentos__primario"
          type="button"
          onClick={() => {
            setErro("");
            setAviso("");
            dialogo.current?.showModal();
          }}
        >
          <IconeGestor nome="mais" /> Registrar abastecimento
        </button>
      </header>
      {erroDownload && (
        <p role="alert" className="abastecimentos__aviso">
          {erroDownload}
        </p>
      )}
      {aviso && (
        <p role="status" className="abastecimentos__aviso">
          {aviso}
        </p>
      )}
      {remoto.loading ? (
        <p role="status">Carregando abastecimentos...</p>
      ) : remoto.error ? (
        <div role="alert" className="abastecimentos__aviso">
          {remoto.error}{" "}
          <button type="button" onClick={remoto.retry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <div
            className="abastecimentos__indicadores"
            aria-label="Resumo dos registros filtrados"
          >
            <article>
              <div className="abastecimentos__indicador-titulo">
                <span>Registros</span>
                <i>
                  <IconeGestor nome="solicitacoes" />
                </i>
              </div>
              <strong>{numero.format(registros.length)}</strong>
              <small>Abastecimentos no período</small>
            </article>
            <article>
              <div className="abastecimentos__indicador-titulo">
                <span>Litros abastecidos</span>
                <i>
                  <IconeGestor nome="abastecimentos" />
                </i>
              </div>
              <strong>{numero.format(litros)} L</strong>
              <small>Total de litros</small>
            </article>
            <article>
              <div className="abastecimentos__indicador-titulo">
                <span>Valor total</span>
                <i>
                  <IconeGestor nome="relatorios" />
                </i>
              </div>
              <strong>{moeda.format(valor)}</strong>
              <small>Total dos abastecimentos</small>
            </article>
          </div>
          <div className="abastecimentos__painel">
            <div className="abastecimentos__painel-topo">
              <div>
                <h2>Histórico de abastecimentos</h2>
                <p>Consulte os registros da frota</p>
              </div>
            </div>
            <div className="abastecimentos__filtros">
              <label>
                Período inicial
                <DatePicker
                  type="date"
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value);
                    setPagina(1);
                  }}
                />
              </label>
              <label>
                Período final
                <DatePicker
                  type="date"
                  value={fim}
                  onChange={(e) => {
                    setFim(e.target.value);
                    setPagina(1);
                  }}
                />
              </label>
              <label>
                Veículo
                <Select
                  aria-label="Filtrar por veículo"
                  value={veiculo}
                  onChange={(e) => {
                    setVeiculo(e.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="">Todos os veículos</option>
                  {remoto.data.veiculos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.placa} — {item.modelo}
                    </option>
                  ))}
                </Select>
              </label>
              <span className="abastecimentos__contagem">
                {numero.format(registros.length)}{" "}
                {registros.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <div className="abastecimentos__tabela">
              <table>
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>Data</th>
                    <th>Quilometragem</th>
                    <th>Litros</th>
                    <th>Valor</th>
                    <th>Comprovante</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosPagina.map((item) => {
                    const veic = remoto.data.veiculos.find(
                      (v) => v.id === item.veiculo_id,
                    );
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            <Link
                              para={rotaHistoricoAbastecimentosVeiculo(
                                String(item.veiculo_id),
                              )}
                            >
                              {item.veiculo_placa ?? "Placa não informada"}
                            </Link>
                          </strong>
                          <small>
                            {veic
                              ? `${veic.modelo} · ${veic.tipo}`
                              : "Veículo não disponível"}
                          </small>
                        </td>
                        <td>
                          {item.data_abastecimento
                            .slice(0, 10)
                            .split("-")
                            .reverse()
                            .join("/")}
                        </td>
                        <td>{item.quilometragem ? (numero.format(item.quilometragem)+'km') : 'Não informada'}</td>
                        <td>{numero.format(Number(item.litragem))} L</td>
                        <td>{moeda.format(Number(item.valor_total))}</td>
                        <td>
                          {item.comprovante_nome ? (
                            <button
                              className="abastecimentos__download"
                              type="button"
                              onClick={() =>
                                void baixar(item.id, item.comprovante_nome!)
                              }
                            >
                              Baixar comprovante
                            </button>
                          ) : (
                            "Não informado"
                          )}
                        </td>
                        <td>
                          <Link
                            para={rotaDetalheAbastecimento(item.id)}
                            className="abastecimentos__download"
                          >
                            Ver detalhes
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {registros.length === 0 && (
                <p className="abastecimentos__vazio">
                  Nenhum abastecimento encontrado para os filtros selecionados.
                </p>
              )}
            </div>

            {registros.length > 0 && (
              <nav
                className="abastecimentos__paginacao"
                aria-label="Paginação dos abastecimentos"
              >
                <button
                  type="button"
                  disabled={paginaAtual === 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  Anterior
                </button>

                <span>
                  Página {paginaAtual} de {totalPaginas}
                </span>

                <button
                  type="button"
                  disabled={paginaAtual === totalPaginas}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </div>
        </>
      )}
      <dialog
        ref={dialogo}
        className="abastecimentos-modal"
        aria-labelledby="abastecimentos-modal-titulo"
        onCancel={(e) => {
          if (salvando) e.preventDefault();
        }}
        onClose={() => abrir.current?.focus()}
      >
        <form onSubmit={salvar}>
          <div className="abastecimentos-modal__topo">
            <div>
              <h2 id="abastecimentos-modal-titulo">Registrar abastecimento</h2>
              <p>Preencha os dados do abastecimento.</p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              disabled={salvando}
              onClick={() => dialogo.current?.close()}
            >
              <IconeGestor nome="fechar" />
            </button>
          </div>
          <fieldset
            disabled={salvando}
            className="abastecimentos-modal__fieldset"
          >
            <div className="abastecimentos-modal__campos">
              <label className="abastecimentos-modal__inteiro">
                Veículo
                <Select name="veiculo" required defaultValue="">
                  <option value="" disabled>
                    Selecione o veículo
                  </option>
                  {remoto.data.veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} — {v.modelo}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="abastecimentos-modal__inteiro">
                Motorista
                <Select name="motorista" required defaultValue="">
                  <option value="" disabled>
                    Selecione o motorista
                  </option>
                  {remoto.data.motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="abastecimentos-modal__inteiro">
                Posto de combustível (opcional)
                <input
                  name="posto"
                  type="text"
                  maxLength={255}
                  placeholder="Informe o posto de combustível"
                />
              </label>

              <label>
                Data
                <DatePicker name="data" type="date" required />
              </label>
              <label>
                Quilometragem
                <input
                  name="quilometragem"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </label>
              <label>
                Litros
                <input
                  name="litros"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Valor total
                <input
                  name="valor"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
            </div>
            <div className="abastecimentos-modal__extras">
              <label className="abastecimentos-modal__check">
                <input type="checkbox" name="tanque" /> Tanque completo
              </label>
              <label>
                Comprovante
                <input
                  type="file"
                  name="comprovante"
                  accept="image/jpeg,image/png"
                />
                <small>JPEG ou PNG, até 1 MiB.</small>
              </label>
            </div>
          </fieldset>
          {erro && (
            <p role="alert" className="abastecimentos-modal__erro">
              {erro}
            </p>
          )}
          <div className="abastecimentos-modal__acoes">
            <button
              type="button"
              disabled={salvando}
              onClick={() => dialogo.current?.close()}
            >
              Cancelar
            </button>
            <button
              className="abastecimentos__primario"
              disabled={salvando || remoto.loading || !!remoto.error}
              type="submit"
            >
              {salvando ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
