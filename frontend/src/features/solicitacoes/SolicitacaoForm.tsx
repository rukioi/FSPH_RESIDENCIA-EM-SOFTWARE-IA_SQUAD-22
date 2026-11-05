import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Icone } from '../../shared/components/Icone'
import { validarSolicitacao } from './regras'
import type { ErrosFormulario, ValoresFormulario } from './regras'
import './solicitacoes.css'

type Props = {
  /** 'nova' = Nova Solicitação · 'editar' = Edição (Gestor ou Solicitante). */
  modo: 'nova' | 'editar'
  valoresIniciais: ValoresFormulario
  /** Exibido como campo bloqueado no modo edição. */
  ticket?: string
  rotuloEnviar: string
  aoEnviar: (valores: ValoresFormulario) => void
  aoCancelar: () => void
}

type Campo = keyof ValoresFormulario

/**
 * Formulário único de Nova Solicitação e Edição.
 * Ticket, solicitante e instituição são SEMPRE somente leitura:
 * vêm da sessão (nova) ou do registro original (edição).
 */
export function SolicitacaoForm({ modo, valoresIniciais, ticket, rotuloEnviar, aoEnviar, aoCancelar }: Props) {
  const [valores, setValores] = useState<ValoresFormulario>(valoresIniciais)
  const [erros, setErros] = useState<ErrosFormulario>({})

  function alterar(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nome = e.target.name as Campo
    setValores((v) => ({ ...v, [nome]: e.target.value }))
    if (erros[nome]) setErros((er) => ({ ...er, [nome]: undefined }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const encontrados = validarSolicitacao(valores)
    setErros(encontrados)
    const primeiro = Object.keys(encontrados)[0]
    if (primeiro) {
      document.getElementById(`sol-${primeiro}`)?.focus()
      return
    }
    aoEnviar(valores)
  }

  function campo(nome: Campo, rotulo: string, opcoes: { tipo?: string; obrigatorio?: boolean; placeholder?: string; inteiro?: boolean; area?: boolean; min?: number; max?: number } = {}) {
    const id = `sol-${nome}`
    const erro = erros[nome]
    return (
      <div className={`campo${erro ? ' campo--erro' : ''}${opcoes.inteiro ? ' sol-grade__inteiro' : ''}`}>
        <label htmlFor={id}>
          {rotulo} {opcoes.obrigatorio && <span className="campo__obrigatorio" aria-hidden="true">*</span>}
        </label>
        {opcoes.area ? (
          <textarea
            id={id}
            name={nome}
            value={valores[nome]}
            onChange={alterar}
            placeholder={opcoes.placeholder}
            aria-required={opcoes.obrigatorio}
            aria-invalid={!!erro}
            aria-describedby={erro ? `${id}-erro` : undefined}
          />
        ) : (
          <input
            id={id}
            name={nome}
            type={opcoes.tipo ?? 'text'}
            value={valores[nome]}
            onChange={alterar}
            placeholder={opcoes.placeholder}
            min={opcoes.min}
            max={opcoes.max}
            aria-required={opcoes.obrigatorio}
            aria-invalid={!!erro}
            aria-describedby={erro ? `${id}-erro` : undefined}
          />
        )}
        {erro && (
          <span id={`${id}-erro`} className="campo__erro">
            {erro}
          </span>
        )}
      </div>
    )
  }

  function bloqueado(id: string, rotulo: string, valor: string) {
    return (
      <div className="campo">
        <label htmlFor={id}>{rotulo}</label>
        <input id={id} value={valor} readOnly aria-readonly="true" tabIndex={-1} />
      </div>
    )
  }

  return (
    <form onSubmit={enviar} noValidate>
      <section className="cartao sol-cartao">
        <div className="sol-cartao__topo">
          <div>
            <h2>
              <Icone nome="motoristas" /> Dados da solicitação
            </h2>
            <p>
              {modo === 'nova'
                ? 'Preenchidos com os dados do usuário logado.'
                : 'Ticket, solicitante e instituição não podem ser alterados.'}
            </p>
          </div>
        </div>
        <div className="sol-cartao__corpo sol-grade">
          {modo === 'editar' && ticket && bloqueado('sol-ticket', 'Ticket', `#${ticket}`)}
          {bloqueado('sol-solicitante', 'Solicitante', valores.solicitante)}
          {bloqueado('sol-instituicao', 'Instituição solicitante', valores.instituicao)}
        </div>
      </section>

      <section className="cartao sol-cartao">
        <div className="sol-cartao__topo">
          <div>
            <h2>
              <Icone nome="calendario" /> Dados do transporte
            </h2>
            <p>
              Campos com <span className="campo__obrigatorio">*</span> são obrigatórios.
            </p>
          </div>
        </div>
        <div className="sol-cartao__corpo sol-grade">
          {campo('data', 'Data', { tipo: 'date', obrigatorio: true })}
          {campo('horario', 'Horário', { tipo: 'time', obrigatorio: true })}
          {campo('origem', 'Origem', { obrigatorio: true, placeholder: 'Local de saída' })}
          {campo('destino', 'Destino', { obrigatorio: true, placeholder: 'Local de destino' })}
          {campo('passageiros', 'Quantidade de passageiros', { tipo: 'number', obrigatorio: true, min: 1, max: 50, placeholder: 'Ex.: 2' })}
          {campo('finalidade', 'Finalidade da solicitação', { obrigatorio: true, inteiro: true, placeholder: 'Ex.: transporte de equipe técnica para reunião' })}
          {campo('observacao', 'Observações', { area: true, inteiro: true, placeholder: 'Informações adicionais para a equipe de transporte (opcional)' })}
          {campo('documentos', 'Documentos ou objetos a transportar', { inteiro: true, placeholder: 'Ex.: caixas térmicas, envelopes lacrados (se houver)' })}
        </div>
      </section>

      <div className="sol-acoes-form">
        <button type="button" className="btn btn--secundario" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primario">
          {rotuloEnviar}
        </button>
      </div>
    </form>
  )
}
