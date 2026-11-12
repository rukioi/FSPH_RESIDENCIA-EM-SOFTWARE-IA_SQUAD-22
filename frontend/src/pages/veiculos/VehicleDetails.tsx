import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Select } from '../../shared/components/Select';
import { IconeGestor } from '../../shared/components/IconeGestor';
import { ROTAS } from '../../app/routes/rotas';
import { useRemoteData } from '../../shared/api/useRemoteData';
import { buscarAbastecimentos } from '../../shared/services/abastecimentos.service';
import { buscarDocumentos } from '../../shared/services/documentos.service';
import { atualizarVeiculo, type VeiculoDto } from '../../shared/services/veiculos.service';
import { VehiclePhoto, VehiclePhotoInput } from './VehiclePhoto';
import { salvarFotoVeiculo, type FotoVeiculo } from '../../shared/services/veiculos.service';
import { VehicleStatusBadge, vehicleTitle, vehicleTypeLabel, formatarQuilometragem } from './VehiclePresentation';
import './VehicleDetails.css';

function campo(valor: string | number | null | undefined) {
  return valor === null || valor === undefined || valor === '' ? 'Não informado' : String(valor);
}

function data(valor: string | null) {
  return valor ? valor.slice(0, 10).split('-').reverse().join('/') : 'Não informada';
}

/** Apresenta os dados reais do veículo e as consultas disponíveis para a gestão da frota. */
export function VehicleDetails({ veiculo, aoVoltar, aoAtualizar, fotoVersao, aoSalvarFoto }: {
  veiculo: VeiculoDto;
  aoVoltar: () => void;
  fotoVersao: number;
  aoSalvarFoto: () => void;
  aoAtualizar?: (veiculo: VeiculoDto) => void;
}) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    tituloRef.current?.focus({ preventScroll: true });
  }, []);
  const [foto, setFoto] = useState<FotoVeiculo | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState({ placa: veiculo.placa, marca: veiculo.marca, modelo: veiculo.modelo, status: veiculo.status ?? '', capacidade_passageiros: veiculo.capacidade_passageiros?.toString() ?? '', vinculo: veiculo.vinculo, fornecedor_locacao: veiculo.fornecedor_locacao ?? '' });
  const dialogo = useRef<HTMLDialogElement>(null);
  const botaoEditar = useRef<HTMLButtonElement>(null);
  function fecharEdicao() { dialogo.current?.close(); setFoto(null); setEditando(false); requestAnimationFrame(() => botaoEditar.current?.focus()); }
  useEffect(() => { if (editando) dialogo.current?.showModal(); }, [editando]);
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErro(''); setSalvando(true);
    try {
      const atualizado = await atualizarVeiculo(veiculo.id, { placa: form.placa.trim(), marca: form.marca.trim(), modelo: form.modelo.trim(), ...(form.status ? { status: form.status } : {}), ...(form.capacidade_passageiros ? { capacidade_passageiros: Number(form.capacidade_passageiros) } : {}), vinculo: form.vinculo, ...(form.vinculo === 'LOCADO' ? { fornecedor_locacao: form.fornecedor_locacao.trim() } : {}) });
      aoAtualizar?.(atualizado);
      if (foto) {
        try { await salvarFotoVeiculo(veiculo.id, foto); aoSalvarFoto(); setFoto(null); }
        catch { setErro('Dados salvos, mas não foi possível salvar a foto. Tente novamente.'); return; }
      }
      fecharEdicao(); setAviso('Veículo atualizado com sucesso.');
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível atualizar o veículo.'); }
    finally { setSalvando(false); }
  }
  const abastecimentos = useRemoteData(buscarAbastecimentos, []);
  const documentos = useRemoteData(buscarDocumentos, []);
  const registros = abastecimentos.data.filter(item => item.veiculo_id === veiculo.id);
  const arquivos = documentos.data.filter(item => item.tipo === 'DOCUMENTO_VEICULO' && item.relacionado_id === veiculo.id);
  const campos = [
    ['Placa', campo(veiculo.placa)], ['Marca', campo(veiculo.marca)],
    ['Modelo', campo(veiculo.modelo)], ['Ano', campo(veiculo.ano)],
    ['Tipo', vehicleTypeLabel(veiculo.tipo)], ['Categoria', veiculo.is_svo === null ? 'Não informada' : veiculo.is_svo ? 'SVO' : 'Administrativo'],
    ['Vínculo', veiculo.vinculo === 'LOCADO' ? 'Locado' : 'Próprio'],
    ['Fornecedor de locação', campo(veiculo.fornecedor_locacao)],
    ['Capacidade de passageiros', campo(veiculo.capacidade_passageiros)],
    ['Capacidade de óbitos', campo(veiculo.capacidade_obitos)],
    ['Quilometragem atual', formatarQuilometragem(veiculo.quilometragem_atual)],
    ['Cadastrado em', data(veiculo.criado_em)],
  ];
  const grupos: { titulo: string; itens: string[][] }[] = [
    { titulo: 'Identificação', itens: campos.slice(0, 4) },
    { titulo: 'Características', itens: [...campos.slice(4, 6), ...campos.slice(8, 11)] },
    { titulo: 'Vínculo e situação', itens: [...campos.slice(6, 8), campos[11]] },
  ];
  const statusDocumento = { SEM_VALIDADE: 'Sem validade', VENCIDA: 'Vencida', PROXIMA_DO_VENCIMENTO: 'Próxima do vencimento', REGULAR: 'Regular' };

  return <section className="vehicle-details">
    <button className="vehicle-details__back" type="button" onClick={aoVoltar}>‹ Voltar para veículos</button>
    <header className="vehicle-details__hero">
      <div className="vehicle-details__image"><VehiclePhoto id={veiculo.id} tipo={veiculo.tipo} versao={fotoVersao} eager /></div>
      <div className="vehicle-details__identity">
        <p className="vehicle-details__eyebrow">Frota / Detalhes do veículo</p>
        <h1 ref={tituloRef} tabIndex={-1}>{vehicleTitle(veiculo.marca, veiculo.modelo)}</h1>
        <p className="vehicle-details__plate">{campo(veiculo.placa)}</p>
        <div className="vehicle-details__tags"><VehicleStatusBadge status={veiculo.status} /><span>{vehicleTypeLabel(veiculo.tipo)}</span><span>{veiculo.is_svo === null ? 'Não informada' : veiculo.is_svo ? 'SVO' : 'Administrativo'}</span></div>
    {aoAtualizar && <button ref={botaoEditar} type="button" className="vehicle-details__edit" onClick={() => { setForm({ placa: veiculo.placa, marca: veiculo.marca, modelo: veiculo.modelo, status: veiculo.status ?? '', capacidade_passageiros: veiculo.capacidade_passageiros?.toString() ?? '', vinculo: veiculo.vinculo, fornecedor_locacao: veiculo.fornecedor_locacao ?? '' }); setErro(''); setEditando(true); }}>Editar veículo</button>}
      </div>
      <div className="vehicle-details__summary"><span>Quilometragem atual</span><strong>{formatarQuilometragem(veiculo.quilometragem_atual)}</strong><small>Ano {campo(veiculo.ano)}</small></div>
    </header>

    {aviso && <p role="status">{aviso}</p>}
    {editando && <dialog ref={dialogo} className="vehicle-details__dialog" aria-labelledby="vehicle-edit-title" onCancel={evento => { if (salvando) evento.preventDefault(); else fecharEdicao(); }}>
      <form onSubmit={salvar}><h2 id="vehicle-edit-title">Editar veículo</h2><div className="vehicle-details__form">
        {(['placa', 'marca', 'modelo'] as const).map(chave => <label key={chave}>{chave[0].toUpperCase() + chave.slice(1)}<input required value={form[chave]} onChange={e => setForm({ ...form, [chave]: e.target.value })} /></label>)}
        <label>Status<Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as typeof form.status })}><option value="" disabled>Não informado</option><option value="DISPONIVEL">Disponível</option><option value="EM_VIAGEM">Em viagem</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option></Select></label>
        <label>Capacidade de passageiros<input type="number" min="1" step="1" value={form.capacidade_passageiros} onChange={e => setForm({ ...form, capacidade_passageiros: e.target.value })} /></label>
        <label>Vínculo<Select value={form.vinculo} onChange={e => setForm({ ...form, vinculo: e.target.value as typeof form.vinculo })}><option value="PROPRIO">Próprio</option><option value="LOCADO">Locado</option></Select></label>
        {form.vinculo === 'LOCADO' && <label>Fornecedor de locação<input required value={form.fornecedor_locacao} onChange={e => setForm({ ...form, fornecedor_locacao: e.target.value })} /></label>}
      </div><VehiclePhotoInput foto={foto} onChange={setFoto} />{erro && <p role="alert">{erro}</p>}<div className="vehicle-details__actions"><button type="button" disabled={salvando} onClick={fecharEdicao}>Cancelar</button><button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</button></div></form>
    </dialog>}

    <article className="vehicle-details__panel">
      <div className="vehicle-details__heading"><div><h2>Dados cadastrais</h2><p>Informações registradas para este veículo.</p></div></div>
      {grupos.map(({ titulo, itens }) => <section className="vehicle-details__group" key={titulo}>
        <h3>{titulo}</h3>
        <dl className="vehicle-details__fields">{itens.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>)}
    </article>

    <div className="vehicle-details__columns">
      <article className="vehicle-details__panel">
        <div className="vehicle-details__heading"><div><h2><IconeGestor nome="manutencao" tamanho={18} /> Manutenção</h2><p>Acompanhamento do veículo</p></div></div>
        <p className="vehicle-details__empty">A consulta de manutenção por veículo ainda não está disponível.</p>
      </article>
      <article className="vehicle-details__panel">
        <div className="vehicle-details__heading"><div><h2><IconeGestor nome="abastecimentos" tamanho={18} /> Abastecimentos</h2><p>Registros associados a este veículo</p></div><a href={ROTAS.abastecimentosGestor}>Abrir abastecimentos →</a></div>
        {abastecimentos.loading && <p role="status">Carregando abastecimentos...</p>}
        {abastecimentos.error && <p role="alert">{abastecimentos.error} <button type="button" onClick={abastecimentos.retry}>Tentar novamente</button></p>}
        {!abastecimentos.loading && !abastecimentos.error && (registros.length === 0 ? <p className="vehicle-details__empty">Nenhum abastecimento registrado para este veículo.</p> : <div className="vehicle-details__table"><table><thead><tr><th>Data</th><th>Quilometragem</th><th className="vehicle-details__number">Litros</th><th className="vehicle-details__number">Valor</th><th>Posto</th></tr></thead><tbody>{registros.map(item => <tr key={item.id}><td>{data(item.data_abastecimento)}</td><td>{formatarQuilometragem(item.quilometragem)}</td><td className="vehicle-details__number">{new Intl.NumberFormat("pt-BR").format(Number(item.litragem))}</td><td className="vehicle-details__number">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.valor_total))}</td><td>{campo(item.posto)}</td></tr>)}</tbody></table></div>)}
      </article>
    </div>

    <article className="vehicle-details__panel">
      <div className="vehicle-details__heading"><div><h2><IconeGestor nome="documentos" tamanho={18} /> Documentos do veículo</h2><p>Documentos associados ao cadastro</p></div></div>
      {documentos.loading && <p role="status">Carregando documentos...</p>}
      {documentos.error && <p role="alert">{documentos.error} <button type="button" onClick={documentos.retry}>Tentar novamente</button></p>}
      {!documentos.loading && !documentos.error && (arquivos.length === 0 ? <p className="vehicle-details__empty">Nenhum documento encontrado para este veículo.</p> : <div className="vehicle-details__table"><table><thead><tr><th>Documento</th><th>Validade</th><th>Situação</th></tr></thead><tbody>{arquivos.map(item => <tr key={item.id}><td>{item.descricao}</td><td>{data(item.data_validade)}</td><td><span className={`vehicle-document-status vehicle-document-status--${item.status.toLowerCase()}`}>{statusDocumento[item.status]}</span></td></tr>)}</tbody></table></div>)}
      <p className="vehicle-details__note">O download de documentos não está disponível.</p>
    </article>

    <article className="vehicle-details__panel"><div className="vehicle-details__heading"><div><h2>Outros históricos</h2><p>Consultas por veículo</p></div></div>
      {['Histórico de manutenção', 'Histórico de quilometragem', 'Multas e infrações', 'Histórico operacional'].map(titulo => <details className="vehicle-details__history" key={titulo}><summary>{titulo}</summary><p>A consulta deste histórico por veículo ainda não está disponível.</p></details>)}
    </article>
  </section>;
}
