import { ROTAS } from './routes/rotas'
import './auth.css'

function Bloco({ classe = '' }: { classe?: string }) {
  return <span className={`auth-skeleton__bloco ${classe}`} />
}

/** Reserva a estrutura da rota sem montar páginas, ações ou dados antes da autorização. */
export function AuthSkeleton({ caminho }: { caminho: string }) {
  const dashboard = caminho === ROTAS.dashboard || caminho === ROTAS.dashboardGestor || caminho === '/svo'
  const indicadores = dashboard || caminho === ROTAS.auditoria

  return (
    <div className="auth-skeleton" role="status" aria-label="Carregando página" aria-busy="true">
      <span className="sr-only">Carregando página</span>
      <div className="auth-skeleton__estrutura" aria-hidden="true">
        <aside className="auth-skeleton__menu">
          <div className="auth-skeleton__marca"><Bloco classe="auth-skeleton__avatar" /><Bloco /></div>
          <div className="auth-skeleton__itens">
            {Array.from({ length: 9 }, (_, i) => <Bloco key={i} />)}
          </div>
          <div className="auth-skeleton__perfil"><Bloco classe="auth-skeleton__avatar" /><Bloco /></div>
        </aside>
        <div className="auth-skeleton__principal">
          <div className="auth-skeleton__cabecalho">
            <Bloco classe="auth-skeleton__avatar" />
            <Bloco classe="auth-skeleton__caminho" />
            <Bloco classe="auth-skeleton__usuario" />
          </div>
          <div className="faixa" />
          <div className="auth-skeleton__conteudo">
            <div className="auth-skeleton__titulo"><Bloco /><Bloco /></div>
            {indicadores && (
              <div className="auth-skeleton__indicadores">
                {Array.from({ length: 4 }, (_, i) => (
                  <div className="cartao auth-skeleton__cartao" key={i}><Bloco /><Bloco classe="auth-skeleton__valor" /></div>
                ))}
              </div>
            )}
            <div className="cartao auth-skeleton__filtros"><Bloco /><Bloco /><Bloco /></div>
            {dashboard ? (
              <div className="auth-skeleton__paineis">
                {[0, 1].map(i => (
                  <div className="cartao auth-skeleton__painel" key={i}>
                    <Bloco />
                    <Bloco classe="auth-skeleton__grafico" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="cartao auth-skeleton__lista">
                {Array.from({ length: 6 }, (_, i) => (
                  <div className="auth-skeleton__linha" key={i}><Bloco /><Bloco /><Bloco /></div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
