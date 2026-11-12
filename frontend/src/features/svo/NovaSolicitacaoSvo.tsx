import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './NovaSolicitacaoPreview.css'

export type NovaSolicitacaoDados = {
  nomeFalecido: string; localFalecimento: string; endereco: string;
  nomeSolicitante: string; telefoneSolicitante: string;
  parentesco: string; pontoReferencia: string; observacoesMedicas: string;
}

/** Reutiliza as quatro seções; sem callback a prévia nunca envia dados. */
export function NovaSolicitacaoSvo({ onVoltar, onConfirmar }: {
  onVoltar?: () => void; onConfirmar?: (dados: NovaSolicitacaoDados) => void | Promise<void>
}) {
  const enviandoRef = useRef(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!onConfirmar || enviandoRef.current) return
    const campos = new FormData(evento.currentTarget)
    const texto = (nome: string) => String(campos.get(nome) ?? '').trim()
    enviandoRef.current = true
    setEnviando(true); setErro('')
    try {
      await onConfirmar({ nomeFalecido: texto('nomeFalecido'), localFalecimento: texto('localFalecimento'),
        endereco: texto('endereco'), nomeSolicitante: texto('nomeSolicitante'), telefoneSolicitante: texto('telefoneSolicitante'),
        parentesco: texto('parentesco'), pontoReferencia: texto('pontoReferencia'), observacoesMedicas: texto('observacoesMedicas') })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a solicitação.')
    } finally { enviandoRef.current = false; setEnviando(false) }
  }
  return (
    <div className="nova-svo">
      <header className="nova-svo__cabecalho">
        <h1>{onConfirmar ? "Nova Solicitação" : "Nova Solicitação SVO"}</h1>
        <p>
          Registre uma solicitação recebida por telefone.
        </p>
      </header>

      <div className="nova-svo__layout">
        <form
          className="nova-svo__form"
          onSubmit={enviar}
        >
          <fieldset disabled={enviando} className="nova-svo__campos">
          <legend className="sr-only">Dados da solicitação</legend>
          <section className="nova-svo__card">
            <div className="nova-svo__titulo-secao">
              <h2>1. Dados do atendimento</h2>
            </div>

            <div className="nova-svo__grid nova-svo__grid--2">
              <label>
                Canal de atendimento *
                <select defaultValue="TELEFONE">
                  <option value="TELEFONE">Telefone</option>
                </select>
              </label>

              <label>
                Data/hora do recebimento
                <input
                  type="text"
                  placeholder="Automático ao registrar"
                  disabled
                />
              </label>
            </div>
          </section>

          <section className="nova-svo__card">
            <div className="nova-svo__titulo-secao">
              <h2>2. Dados do solicitante</h2>
              <p>
                Pessoa que entrou em contato. Ela não acessa o sistema.
              </p>
            </div>

            <div className="nova-svo__grid nova-svo__grid--2">
              <label className="nova-svo__campo--largo">
                {onConfirmar ? "Nome do solicitante *" : "Nome completo *"}
                <input
                  type="text"
                  name="nomeSolicitante" maxLength={150}
                  placeholder="Nome completo do solicitante"
                  required
                />
              </label>

              <label>
                CPF (aguardando definição do contrato)
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  disabled
                  aria-describedby="campos-pendentes"
                />
              </label>

              <label>
                Telefone / WhatsApp
                <input
                  name="telefoneSolicitante" maxLength={20} minLength={7} type="tel"
                  placeholder="(79) 00000-0000"
                />
              </label>

              <label>
                Data de nascimento
                <input type="date" disabled aria-describedby="campos-pendentes" />
              </label>

              <label>
                Relação com a pessoa falecida
                <input name="parentesco" maxLength={50} type="text" placeholder="Informe a relação relatada" />
              </label>

              <label className="nova-svo__campo--largo">
                Endereço do solicitante (aguardando definição do contrato)
                <input
                  type="text"
                  placeholder="Rua, número — bairro, cidade"
                  disabled
                  aria-describedby="campos-pendentes"
                />
              </label>
            </div>
            <p className="nova-svo__pendencia" id="campos-pendentes">CPF, nascimento e endereço do solicitante dependem de aprovação no contrato. Não são exigidos nem enviados.</p>
          </section>

          <section className="nova-svo__card">
            <div className="nova-svo__titulo-secao">
              <h2>3. Dados da ocorrência</h2>
            </div>

            <div className="nova-svo__grid nova-svo__grid--2">
              <label>Nome da pessoa falecida<input name="nomeFalecido" maxLength={150} type="text" /></label>
              <label>Local do falecimento *<input name="localFalecimento" maxLength={255} type="text" required /></label>
              <label>
                {onConfirmar ? "Endereço de remoção *" : "Endereço da ocorrência *"}
                <input
                  name="endereco" maxLength={255} type="text"
                  placeholder="Rua, número — bairro, cidade"
                  required
                />
              </label>

              <label>
                Ponto de referência
                <input
                  type="text"
                  name="pontoReferencia" maxLength={255} placeholder="Ex.: próximo à praça"
                />
              </label>
            </div>
          </section>

          <section className="nova-svo__card">
            <div className="nova-svo__titulo-secao">
              <h2>4. Informações complementares</h2>
            </div>

            <label>
              Informações validadas na ligação
              <textarea
                name="observacoesMedicas" maxLength={2000} rows={5}
                placeholder="O que foi relatado no contato"
              />
            </label>
          </section>

          </fieldset>
          {enviando && <p role="status">Registrando solicitação...</p>}
          {erro && <p role="alert">{erro}</p>}
          {!onConfirmar && <p className="nova-svo__nota" id="confirmacao-preview">O envio da solicitação está indisponível nesta prévia.</p>}
          <div className="nova-svo__acoes">
            <button
              type="button"
              className="nova-svo__botao nova-svo__botao--secundario"
              onClick={onVoltar} disabled={enviando}
            >
              {onConfirmar ? "← Voltar" : "Cancelar"}
            </button>

            <button
              type="submit"
              className="nova-svo__botao nova-svo__botao--primario"
              disabled={!onConfirmar || enviando}
              aria-describedby={onConfirmar ? undefined : "confirmacao-preview"}
            >
              {onConfirmar ? (enviando ? "Registrando..." : "Registrar") : "Confirmar solicitação"}
            </button>
          </div>
        </form>

        <aside className="nova-svo__lateral">
          <div className="nova-svo__info">
            <div className="nova-svo__info-titulo">
              <span aria-hidden="true">ⓘ</span>
              <h2>Como funciona</h2>
            </div>

            <ol>
              <li>
                Valide as informações durante a própria ligação.
              </li>

              <li>
                Ao registrar, a solicitação entra na fila Aguardando triagem.
              </li>

              <li>
                Na triagem, o atendente decide entre SVO e IML.
              </li>

              <li>
                Somente a decisão SVO gera uma ordem de coleta para despacho.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}
