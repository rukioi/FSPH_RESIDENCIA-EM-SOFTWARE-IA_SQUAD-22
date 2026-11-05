import { useState } from 'react'
import { navegar } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'
import { Icone } from '../../shared/components/Icone'
import type { UsuarioSessao } from '../../shared/services/auth.service'
import { INSTITUICAO_DEMO } from '../../features/solicitacoes/dados'
import { formatarData } from '../../features/solicitacoes/regras'
import type { ValoresFormulario } from '../../features/solicitacoes/regras'
import { SolicitacaoForm } from '../../features/solicitacoes/SolicitacaoForm'
import '../../features/solicitacoes/solicitacoes.css'
import './NovaSolicitacao.css'

function instituicaoDaSessao(u: UsuarioSessao): string {
  const valor = (u as { instituicao?: unknown }).instituicao
  return typeof valor === 'string' && valor ? valor : INSTITUICAO_DEMO
}

export function NovaSolicitacao({ usuario }: { usuario: UsuarioSessao }) {
  const instituicao = instituicaoDaSessao(usuario)
  const vazio: ValoresFormulario = {
    instituicao,
    solicitante: usuario.nome ?? usuario.email ?? '',
    data: '',
    horario: '',
    origem: instituicao,
    destino: '',
    passageiros: '1',
    finalidade: '',
    observacao: '',
    documentos: '',
  }
  const [etapa, setEtapa] = useState<'formulario' | 'revisao' | 'enviada'>('formulario')
  const [valores, setValores] = useState<ValoresFormulario>(vazio)

  const linhas: [string, string][] = [
    ['Instituição solicitante', valores.instituicao],
    ['Solicitante', valores.solicitante],
    ['Data', formatarData(valores.data)],
    ['Horário', valores.horario],
    ['Origem', valores.origem],
    ['Destino', valores.destino],
    ['Passageiros', valores.passageiros],
    ['Finalidade', valores.finalidade],
    ['Observações', valores.observacao || '—'],
    ['Documentos ou objetos', valores.documentos || '—'],
  ]

  return (
    <div className="nova-sol">
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">
            {etapa === 'revisao' ? 'Revise sua solicitação' : 'Nova solicitação de transporte'}
          </h1>
          <p className="pagina__descricao">
            {etapa === 'revisao'
              ? 'Confira os dados antes de enviar. Você ainda pode voltar e corrigir.'
              : 'Informe os dados necessários para registrar sua demanda.'}
          </p>
        </div>
      </div>

      {etapa === 'formulario' && (
        <SolicitacaoForm
          // a key recria o formulário com os valores atuais ao voltar da revisão
          key={JSON.stringify(valores)}
          modo="nova"
          valoresIniciais={valores}
          rotuloEnviar="Revisar solicitação"
          aoCancelar={() => navegar(ROTAS.minhasSolicitacoes)}
          aoEnviar={(v) => {
            setValores(v)
            setEtapa('revisao')
            window.scrollTo({ top: 0 })
          }}
        />
      )}

      {etapa === 'revisao' && (
        <>
          <section className="cartao sol-cartao">
            <div className="sol-cartao__topo">
              <h2>
                <Icone nome="solicitacoes" /> Resumo
              </h2>
            </div>
            <dl className="sol-cartao__corpo sol-grade nova-sol__resumo">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="sol-acoes-form">
            <button type="button" className="btn btn--secundario" onClick={() => setEtapa('formulario')}>
              Voltar e corrigir
            </button>
            <button type="button" className="btn btn--primario" onClick={() => setEtapa('enviada')}>
              Confirmar envio
            </button>
          </div>
        </>
      )}

      {etapa === 'enviada' && (
        <div className="cartao vazio">
          <strong>Solicitação conferida</strong>
          <p>Demonstração: os dados não foram enviados. O envio será ativado na integração com o sistema.</p>
          <div className="sol-acoes-form" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button
              type="button"
              className="btn btn--secundario"
              onClick={() => {
                setValores(vazio)
                setEtapa('formulario')
              }}
            >
              Nova solicitação
            </button>
            <button type="button" className="btn btn--primario" onClick={() => navegar(ROTAS.minhasSolicitacoes)}>
              Ver minhas solicitações
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
