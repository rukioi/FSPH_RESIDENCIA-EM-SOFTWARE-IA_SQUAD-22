import { Select } from '../../shared/components/Select';
import { IconeGestor } from '../../shared/components/IconeGestor'
import { useRemoteData } from '../../shared/api/useRemoteData';
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { buscarVeiculos, cadastrarVeiculo as salvarVeiculo, salvarFotoVeiculo, type FotoVeiculo } from "../../shared/services/veiculos.service";
import type { VeiculoDto } from "../../shared/services/veiculos.service";
import { VehiclePhoto, VehiclePhotoInput } from './VehiclePhoto';
import { VehicleDetails } from "./VehicleDetails";
import { VehicleStatusBadge, vehicleTitle, vehicleTypeLabel, formatarQuilometragem } from "./VehiclePresentation";
import "./Veiculos.css";

type Veiculo = VeiculoDto;

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

function normalizarStatus(status?: string | null) {
  return (status ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ -]/g, "_");
}

/** Apresenta a frota e confirma alteracoes somente apos resposta validada. */
export function Veiculos() {
  const {data:veiculos,setData:setVeiculos,loading:carregando,error:erro,retry} = useRemoteData<Veiculo[]>(buscarVeiculos, []);
  const [erroFormulario, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroSvo, setFiltroSvo] = useState("TODOS");
  const [veiculoSelecionado, setVeiculoSelecionado] =
    useState<Veiculo | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const cadastroDialog = useRef<HTMLDialogElement>(null);
  const cadastroTrigger = useRef<HTMLButtonElement>(null);
  const cadastroVisitado = useRef(false);
  useEffect(() => {
    if (modalAberto) { cadastroDialog.current?.showModal(); cadastroVisitado.current = true; }
    else if (cadastroVisitado.current) cadastroTrigger.current?.focus();
  }, [modalAberto]);
  const [salvando, setSalvando] = useState(false);
  const [foto, setFoto] = useState<FotoVeiculo | null>(null);
  const [fotoVersao, setFotoVersao] = useState(0);
  const [formulario, setFormulario] =
    useState<FormularioVeiculo>(formularioInicial);


  const tiposVeiculo = useMemo(
    () =>
      Array.from(
        new Set(
          veiculos
            .map((veiculo) => veiculo.tipo)
            .filter(Boolean),
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

      const novoVeiculo = await salvarVeiculo({
          placa: formulario.placa.trim().toUpperCase(),
          marca: formulario.marca.trim(),
          modelo: formulario.modelo.trim(),
          ano: Number(formulario.ano),
          tipo: formulario.tipo,
          capacidade_obitos: Number(formulario.capacidade_obitos || 0),
          quilometragem_atual: Number(formulario.quilometragem_atual || 0),
          status: formulario.status,
          is_svo: formulario.is_svo,
      });
      setVeiculos((atuais) => [novoVeiculo, ...atuais]);
      let mensagem = 'Veículo cadastrado com sucesso.';
      if (foto) {
        try { await salvarFotoVeiculo(novoVeiculo.id, foto); setFotoVersao(v => v + 1); }
        catch { mensagem = 'Veículo cadastrado, mas não foi possível salvar a foto. Tente novamente nos detalhes do veículo.'; }
      }
      setAviso(mensagem);
      setFoto(null);

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
      <VehicleDetails
        veiculo={veiculoSelecionado}
        aoVoltar={() => setVeiculoSelecionado(null)}
        fotoVersao={fotoVersao}
        aoSalvarFoto={() => setFotoVersao(v => v + 1)}
        aoAtualizar={(atualizado) => {
          setVeiculos((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item));
          setVeiculoSelecionado(atualizado);
        }}
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
          ref={cadastroTrigger}
          type="button"
          onClick={() => {
            setErro("");
            setFoto(null);
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
              <IconeGestor nome="veiculos" tamanho={18} />
            </span>
          </div>
          <strong>{carregando || erro ? "—" : veiculos.length}</strong>
          <small>{!carregando && !erro ? `${totalIndisponiveis} indisponíveis` : "Atualizando frota"}</small>
        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Disponíveis</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--verde">
              <IconeGestor nome="confirmado" tamanho={18} />
            </span>
          </div>
          <strong>{carregando || erro ? "—" : totalDisponiveis}</strong>

        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Em viagem</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--azul">
              <IconeGestor nome="rota" tamanho={18} />
            </span>
          </div>
          <strong>{carregando || erro ? "—" : totalEmViagem}</strong>

        </article>

        <article className="veiculos-indicador">
          <div className="veiculos-indicador__topo">
            <span>Em manutenção</span>
            <span className="veiculos-indicador__icone veiculos-indicador__icone--amarelo">
              <IconeGestor nome="manutencao" tamanho={18} />
            </span>
          </div>
          <strong>{carregando || erro ? "—" : totalEmManutencao}</strong>

        </article>
      </section>

      <div className="veiculos-filtros">
        <label className="veiculos-busca">
          <span className="veiculos-somente-leitor">
            Buscar por placa ou modelo
          </span>
          <span aria-hidden="true"><IconeGestor nome="busca" tamanho={18} /></span>
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
          <Select
            value={filtroStatus}
            onChange={(evento) => setFiltroStatus(evento.target.value)}
          >
            <option value="TODOS">Todos os status</option>
            <option value="DISPONIVEL">Disponível</option>
            <option value="EM_VIAGEM">Em viagem</option>
            <option value="EM_MANUTENCAO">Em manutenção</option>
            <option value="INDISPONIVEL">Indisponível</option>
          </Select>
        </label>

        <label>
          <span className="veiculos-somente-leitor">Filtrar por tipo</span>
          <Select
            value={filtroTipo}
            onChange={(evento) => setFiltroTipo(evento.target.value)}
          >
            <option value="TODOS">Todos os tipos</option>
            {tiposVeiculo.map((tipo) => (
              <option key={tipo} value={tipo}>
                {vehicleTypeLabel(tipo)}
              </option>
            ))}
          </Select>
        </label>

        <label>
          <span className="veiculos-somente-leitor">
            Filtrar por categoria
          </span>
          <Select
            value={filtroSvo}
            onChange={(evento) => setFiltroSvo(evento.target.value)}
          >
            <option value="TODOS">Todas as categorias</option>
            <option value="ADMINISTRATIVO">Administrativo</option>
            <option value="SVO">SVO</option>
          </Select>
        </label>

        <span className="veiculos-resultado">
          {veiculosFiltrados.length} de {veiculos.length} veículos
        </span>
      </div>

      {erro && !modalAberto && (
        <p className="veiculos-aviso veiculos-aviso--erro" role="alert">
          {erro} <button type="button" onClick={retry}>Tentar novamente</button>
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}

      {carregando && (
        <p className="veiculos-aviso" role="status">Carregando veículos...</p>
      )}

      {!carregando && !erro && veiculosFiltrados.length === 0 && (
        <div className="veiculos-vazio">
          <h2>{veiculos.length ? "Nenhum resultado encontrado" : "Nenhum veículo cadastrado"}</h2>
          <p>{veiculos.length ? "Ajuste a busca ou os filtros para encontrar um veículo." : "Cadastre um veículo para começar a organizar a frota."}</p>
          {(busca || filtroStatus !== "TODOS" || filtroTipo !== "TODOS" || filtroSvo !== "TODOS") && <button type="button" className="veiculos-botao-secundario" onClick={() => { setBusca(""); setFiltroStatus("TODOS"); setFiltroTipo("TODOS"); setFiltroSvo("TODOS"); }}>Limpar filtros</button>}
        </div>
      )}

      {!carregando && !erro && veiculosFiltrados.length > 0 && (
        <div className="veiculos-grade">
          {veiculosFiltrados.map((veiculo, indice) => {
            const chave =
              veiculo.id ?? `${veiculo.placa ?? "veiculo"}-${indice}`;

            return (
              <article className="veiculo-card" key={chave}>
                <div className="veiculo-card__midia">
                  <VehiclePhoto id={veiculo.id} tipo={veiculo.tipo} versao={fotoVersao} />
                  <VehicleStatusBadge status={veiculo.status} />
                </div>
                <div className="veiculo-card__conteudo">
                  <h2 title={vehicleTitle(veiculo.marca, veiculo.modelo)}>{vehicleTitle(veiculo.marca, veiculo.modelo)}</h2>
                  <p className="veiculo-card__utilizacao">{veiculo.is_svo === null ? "Utilização não informada" : veiculo.is_svo ? "SVO" : "Administrativo"} · {veiculo.vinculo === "LOCADO" ? "Locado" : "Próprio"}</p>
                  <p className="veiculo-card__placa"><span>Placa</span> <strong>{veiculo.placa || "Não informada"}</strong></p>
                  <dl className="veiculo-card__dados">
                    <div><dt>Ano</dt><dd>{veiculo.ano ?? "Não informado"}</dd></div>
                    <div><dt>Tipo</dt><dd>{vehicleTypeLabel(veiculo.tipo)}</dd></div>
                    <div><dt>Quilometragem</dt><dd>{formatarQuilometragem(veiculo.quilometragem_atual)}</dd></div>
                  </dl>
                </div>
                <button className="veiculo-card__detalhes-botao" aria-label={`Ver detalhes de ${veiculo.placa}`} type="button" onClick={() => setVeiculoSelecionado(veiculo)}>
                  Ver detalhes<span aria-hidden="true">→</span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div className="veiculos-modal-fundo">
          <dialog
            ref={cadastroDialog}
            onCancel={(event) => { if (salvando) event.preventDefault(); else setModalAberto(false); }}
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
                disabled={salvando}
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
                <Select value={formulario.tipo} onChange={(evento) => atualizarCampo("tipo", evento.target.value)}>
                  <option value="PASSEIO">Passeio</option>
                  <option value="VAN">Van</option>
                  <option value="AMBULANCIA">Ambulância</option>
                  <option value="RABECÃO_SVO">Rabecão SVO</option>
                </Select>
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
                <Select
                  value={formulario.status}
                  onChange={(evento) =>
                    atualizarCampo("status", evento.target.value)
                  }
                >
                  <option value="DISPONIVEL">Disponível</option>
                  <option value="EM_VIAGEM">Em viagem</option>
                  <option value="EM_MANUTENCAO">Em manutenção</option>
                  <option value="INDISPONIVEL">Indisponível</option>
                </Select>
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

              <VehiclePhotoInput foto={foto} onChange={setFoto} />

              {salvando && <p role="status">Salvando veículo...</p>}
              {erroFormulario && (
                <p className="veiculos-aviso veiculos-aviso--erro" role="alert">
                  {erroFormulario}
                </p>
              )}

              <div className="veiculos-formulario__acoes">
                <button
                  type="button"
                  className="veiculos-botao-secundario"
                  disabled={salvando}
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
          </dialog>
        </div>
      )}
    </section>
  );
}
