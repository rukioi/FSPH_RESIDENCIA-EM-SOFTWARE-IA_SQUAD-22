import type { ReactNode } from 'react'
import { MarcaInstitucional } from '../../shared/components/MarcaInstitucional'
import './LoginLayout.css'

export function LoginLayout({ children, acessoMotorista }: { children: ReactNode; acessoMotorista: boolean }) {
  return (
    <div className={`login-layout${acessoMotorista ? ' login-layout--motorista' : ''}`}>
      <section className="login-layout__marca" aria-label="Gestão de Frotas">
        <div className="login-layout__topo">
          <strong>Gestão de Frotas</strong><small>Central de Transporte</small>
        </div>
        <div className="login-layout__conteudo">
          <span className="login-layout__logo"><MarcaInstitucional /></span>
          <div className="login-layout__chamada">
            <span className="login-layout__etiqueta">FUNDAÇÃO DE SAÚDE PARREIRAS HORTA</span>
            <h2>{acessoMotorista ? 'Seu acesso, motorista.' : 'Juntos, movemos o cuidado.'}</h2>
            <p>{acessoMotorista ? 'Entre com sua conta para acessar seu espaço na Central de Transporte.' : 'Um espaço para acompanhar e organizar o transporte da nossa instituição.'}</p>
            <div className="login-layout__linha" aria-hidden="true" />
          </div>
        </div>
        <p className="login-layout__rodape">Gestão de Frotas <span>•</span> FSPH</p>
      </section>
      <main className="login-layout__formulario">{children}</main>
    </div>
  )
}
