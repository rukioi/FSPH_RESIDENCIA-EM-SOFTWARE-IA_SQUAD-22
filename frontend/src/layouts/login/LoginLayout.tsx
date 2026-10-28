import type { ReactNode } from 'react'
import { Icone } from '../../shared/components/Icone'
import './LoginLayout.css'

const destaques = [
  { icone: 'solicitacoes', texto: 'Solicitações e agendamentos de viagens' },
  { icone: 'veiculos', texto: 'Frota, motoristas e documentação' },
  { icone: 'relatorios', texto: 'Relatórios, abastecimentos e auditoria' },
] as const

export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="login-layout">
      <section className="login-layout__marca" aria-hidden="true">
        <div className="login-layout__topo">
          <span className="login-layout__logo">
            <Icone nome="veiculos" tamanho={26} />
          </span>
          <div>
            <strong>Gestão de Frotas</strong>
            <small>Central de Transporte</small>
          </div>
        </div>

        <div className="login-layout__chamada">
          <h2>Toda a operação da frota em um só lugar.</h2>
          <ul>
            {destaques.map((d) => (
              <li key={d.texto}>
                <span>
                  <Icone nome={d.icone} />
                </span>
                {d.texto}
              </li>
            ))}
          </ul>
        </div>

        <div className="login-layout__estrada" />
      </section>

      <main className="login-layout__formulario">
        <div className="login-layout__faixa" />
        {children}
      </main>
    </div>
  )
}
