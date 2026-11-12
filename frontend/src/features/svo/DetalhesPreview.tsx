import { useRef, useState } from 'react'
import { Atalho, Campos, Pagina, Painel, varianteVisual } from './PreviewPainel'
import { PREVIEW_SVO } from './preview'

/** Demonstra as ações de triagem apenas na memória desta tela DEV. */
export function TriagemPreview() {
  const estado = varianteVisual()
  const concluida = estado === 'concluida'
  const bloqueada = concluida || ['conflito', 'loading', 'erro'].includes(estado ?? '')
  const confirmacao = useRef<HTMLDialogElement>(null)
  const [destino, setDestino] = useState<'' | 'SVO' | 'IML'>('')
  const [observacoes, setObservacoes] = useState('')
  const [feedback, setFeedback] = useState('')
  return <Pagina titulo="Triagem" descricao="Avalie a solicitação antes de definir o destino da ocorrência." acao={<Atalho href={PREVIEW_SVO.solicitacoes}>Voltar às solicitações</Atalho>}>
    <Painel titulo="Identificação"><Campos nomes={['Protocolo', 'Recebimento', 'Canal de atendimento']}/></Painel>
    <div className="svo-dupla">
      <Painel titulo="Dados do solicitante"><Campos nomes={['Nome', 'Telefone', 'Relação com a pessoa falecida']}/></Painel>
      <Painel titulo="Dados da ocorrência"><Campos nomes={['Endereço', 'Ponto de referência']}/></Painel>
    </div>
    <Painel titulo="Informações do atendimento"><Campos nomes={['Relato registrado']}/></Painel>
    <Painel titulo="Decisão da triagem">
      {estado === 'loading' && <p role="status">Carregando os dados da triagem…</p>}
      {estado === 'erro' && <p role="alert">Não foi possível consultar a triagem. Nenhuma decisão pode ser confirmada.</p>}
      {concluida && <p className="svo-aviso" role="status">Triagem concluída · somente leitura.</p>}
      {estado === 'conflito' && <p className="svo-aviso" role="alert">Conflito (409). Consulte a decisão atual antes de continuar.</p>}
      <p>Confirmar SVO gera a ordem de coleta. O encaminhamento ao IML não gera ordem de coleta SVO.</p>
      <fieldset className="svo-decisao" disabled={bloqueada}><legend>Destino</legend>
        {(['SVO', 'IML'] as const).map(opcao => <label key={opcao}>
          <input type="radio" name="destino" value={opcao} checked={destino === opcao}
            onChange={() => { setDestino(opcao); setFeedback('') }}/>
          {opcao}
        </label>)}
      </fieldset>
      <label className="svo-campo">Observações da triagem
        <textarea rows={3} readOnly={bloqueada} value={observacoes}
          onChange={evento => { setObservacoes(evento.target.value); setFeedback('') }}/>
      </label>
      <div className="svo-acoes">
        <button type="button" disabled={bloqueada || (!destino && !observacoes.trim())}
          onClick={() => setFeedback('Salvar andamento: o registro das alterações depende da integração com o backend.')}>Salvar andamento</button>
        <button type="button" disabled={bloqueada || destino !== 'SVO'}
          onClick={() => confirmacao.current?.showModal()}>Confirmar SVO</button>
        <button type="button" disabled={bloqueada || destino !== 'IML'}
          onClick={() => confirmacao.current?.showModal()}>Encaminhar IML</button>
      </div>
      <dialog ref={confirmacao} className="svo-confirmacao" aria-labelledby="confirmar-triagem-titulo" aria-describedby="confirmar-triagem-descricao">
        <h2 id="confirmar-triagem-titulo">Confirmar decisão da triagem</h2>
        <p id="confirmar-triagem-descricao">Destino selecionado: {destino}. {destino === 'SVO'
          ? 'No fluxo integrado, confirmar SVO gera uma ordem de coleta.'
          : 'O encaminhamento ao IML não gera ordem de coleta SVO.'} Esta prévia não salva nem envia a decisão.</p>
        <form method="dialog" className="svo-acoes">
          <button type="submit">Voltar à triagem</button>
          <button type="submit" onClick={() => setFeedback(destino === 'SVO'
            ? 'Confirmar SVO: a confirmação e a geração da ordem dependem da integração com o backend.'
            : 'Encaminhar IML: o encaminhamento depende da integração com o backend.')}>Confirmar prévia</button>
        </form>
      </dialog>
      <div role="status" className="svo-feedback-triagem">
        {feedback && <p>Prévia visual. {feedback}</p>}
      </div>
    </Painel>
  </Pagina>
}

export function OrdemPreview() {
  return <Pagina titulo="Detalhe da ordem" descricao="Consulte os dados da coleta e acompanhe o andamento da ordem." acao={<Atalho href={PREVIEW_SVO.ordens}>Voltar às ordens</Atalho>}>
    <Painel titulo="Ordem de coleta"><Campos nomes={['Identificação da ordem', 'Status', 'Solicitação relacionada', 'Endereço de coleta']}/></Painel>
    <div className="svo-dupla"><Painel titulo="Equipe de coleta"><Campos nomes={['Motorista', 'Veículo']}/></Painel>
      <Painel titulo="Etapas da execução"><p>Etapas indisponíveis no momento.</p></Painel></div>
    <Painel titulo="Histórico e auditoria"><p>A sequência de eventos estará disponível após a consulta da ordem.</p></Painel>
    <div className="svo-atalhos"><span>Prévia da tela</span><Atalho href={window.location.pathname + '/despacho'}>Preparar despacho</Atalho></div>
  </Pagina>
}

export function DespachoPreview() {
  const estado = varianteVisual()
  const disponibilidade = estado === 'disponivel' ? 'Disponível' : estado === 'ocupado' ? 'Ocupado' : 'Indisponível'
  return <Pagina titulo="Preparar despacho" descricao="Selecione o motorista e o veículo para a ordem de coleta.">
    <p className="svo-aviso">Seleção e confirmação indisponíveis até a consulta de elegibilidade, CNH e ocupação pelo backend. A disponibilidade não é calculada nesta tela.</p>
    {estado === 'loading' && <p role="status">Carregando os recursos para despacho…</p>}
    {estado === 'erro' && <p role="alert">Não foi possível consultar os recursos. Nenhum despacho foi confirmado.</p>}
    <div className="svo-despacho">
      <div className="svo-despacho__etapas">
        <Painel titulo="1. Resumo da ordem de coleta"><Campos nomes={['Ordem', 'Protocolo', 'Solicitante', 'Canal', 'Data/hora', 'Endereço da ocorrência', 'Status', 'Informações do atendimento']}/></Painel>
        <Painel titulo="2. Selecionar motorista"><label className="svo-campo">Motorista<select disabled><option>Consulta indisponível</option></select></label></Painel>
        <Painel titulo="3. Selecionar veículo"><label className="svo-campo">Veículo SVO<select disabled><option>Consulta indisponível</option></select></label>
          <div className="svo-ocupacao"><strong>Ocupação do veículo</strong><span className="svo-disponibilidade" data-estado={estado}>Disponibilidade: {disponibilidade}</span>
            <div className="svo-vagas" aria-hidden="true"><i/><i/><i/><i/></div>
            <small>Escala de 0/4 a 4/4 · ocupação atual indisponível</small>
          </div>
        </Painel>
      </div>
      <Painel titulo="4. Confirmar despacho">
        <Campos nomes={['Ordem', 'Protocolo', 'Endereço', 'Motorista', 'Veículo']}/>
        {estado === 'conflito' && <p className="svo-aviso" role="alert">Conflito (409). A disponibilidade mudou. Consulte a alocação antes de confirmar.</p>}
        <div className="svo-acoes"><button disabled>Confirmar despacho</button>
          <Atalho href={window.location.pathname.replace(/\/despacho$/, '')}>Cancelar</Atalho></div>
      </Painel>
    </div>
  </Pagina>
}

export function ExecucaoPreview() {
  return <Pagina titulo="Execução da ordem" descricao="Acompanhe as etapas da coleta e os registros da equipe." acao={<Atalho href={PREVIEW_SVO.equipe}>Minhas Ordens</Atalho>}>
    <Painel titulo="Ordem atribuída"><Campos nomes={['Ordem', 'Status', 'Local de coleta', 'Motorista', 'Veículo', 'Início da execução']}/></Painel>
    <Painel titulo="Etapas da coleta"><p>Andamento indisponível no momento.</p></Painel>
    <Painel titulo="Registro de execução"><Campos nomes={['Evidências', 'Quilometragem']}/>
      <div className="svo-acoes"><button disabled>Iniciar execução</button><button disabled>Registrar evidência</button><button disabled>Concluir execução</button></div>
    </Painel>
  </Pagina>
}
