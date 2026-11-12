import { PREVIEW_SVO } from './preview'
import { Atalho, Pagina, Painel, varianteVisual } from './PreviewPainel'

const listas = {
  solicitacoes: {
    titulo: 'Solicitações', descricao: 'Consulte e acompanhe os atendimentos registrados.', fila: 'Aguardando triagem', busca: 'Protocolo, solicitante ou endereço',
    colunas: ['Protocolo', 'Recebimento', 'Canal', 'Solicitante', 'Endereço', 'Status', 'Ações'],
  },
  ordens: {
    titulo: 'Ordens de Coleta', descricao: 'Consulte as ordens de coleta vinculadas às solicitações SVO.', fila: 'Listagem de ordens', busca: 'Ordem, solicitação ou motorista',
    colunas: ['Ordem', 'Solicitação', 'Data/hora', 'Local', 'Motorista', 'Veículo', 'Status', 'Ações'],
  },
  equipe: {
    titulo: 'Minhas Ordens', descricao: 'Acompanhe as ordens atribuídas à equipe.', fila: 'Ordens atribuídas', busca: 'Ordem, local ou veículo',
    colunas: ['Ordem', 'Status', 'Local', 'Veículo', 'Início da execução', 'Ações'],
  },
}

function EstadoLista() {
  switch (varianteVisual()) {
    case 'loading': return <p role="status">Carregando a listagem…</p>
    case 'erro': return <p role="alert">Não foi possível consultar a listagem.</p>
    case 'vazio': return <p>Nenhum registro encontrado para os filtros selecionados.</p>
    default: return <p><strong>Consulta indisponível</strong><br/>Os registros poderão ser consultados quando o serviço estiver disponível.</p>
  }
}

/** Estrutura compartilhada das filas. Os atalhos de detalhe não representam linhas reais. */
export function ListaPreview({ tipo }: { tipo: keyof typeof listas }) {
  const { titulo, fila, busca, colunas } = listas[tipo]
  const solicitacoes = tipo === 'solicitacoes'
  return <Pagina titulo={titulo} descricao={listas[tipo].descricao} acao={solicitacoes && <Atalho href={PREVIEW_SVO.nova} primario>Nova Solicitação</Atalho>}>
    <Painel titulo={fila}>
      <p id="filtros-indisponiveis">Filtros indisponíveis até a integração da consulta. Nenhum registro ou total foi carregado.</p>
      <fieldset className="svo-filtros" disabled aria-describedby="filtros-indisponiveis"><legend className="sr-only">Filtros da listagem</legend>
        <label>Busca<input type="search" placeholder={busca}/></label>
        <label>Status<select><option>Todos os status</option></select></label>
        {solicitacoes && <label>Canal<select><option>Todos os canais</option></select></label>}
        <label>Período<select><option>Todo o período</option></select></label>
      </fieldset>
      <div className="svo-tabela" tabIndex={0} role="region" aria-label={fila}>
        <table><caption className="sr-only">{fila}</caption><thead><tr>{colunas.map(coluna => <th key={coluna} scope="col">{coluna}</th>)}</tr></thead>
        <tbody><tr><td colSpan={colunas.length}><EstadoLista/></td></tr></tbody></table>
      </div>
      <nav className="svo-atalhos" aria-label="Prévias de detalhe">
        <span>Prévia das telas</span>
        {solicitacoes ? <Atalho href={PREVIEW_SVO.triagem}>Abrir triagem</Atalho> : tipo === 'equipe'
          ? <Atalho href={PREVIEW_SVO.execucao}>Ver execução</Atalho> : <>
            <Atalho href={PREVIEW_SVO.detalhe}>Ver ordem</Atalho>
            <Atalho href={PREVIEW_SVO.despacho}>Preparar despacho</Atalho></>}
      </nav>
    </Painel>
  </Pagina>
}

export function SolicitacoesSvo() {
  return <ListaPreview tipo="solicitacoes"/>
}
