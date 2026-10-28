import { Icone } from '../../shared/components/Icone'
import './DashboardAdm.css'

export function DashboardAdmin() {
  return (
    <div className="dashboard-admin">
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Dashboard</h1>
          <p className="pagina__descricao">Painel do Administrador</p>
        </div>
      </div>

      <section className="dashboard-admin__vazio cartao" aria-label="Conteúdo do dashboard">
        <span className="dashboard-admin__icone">
          <Icone nome="dashboard" tamanho={28} />
        </span>
        <h2>Conteúdo em construção</h2>
        <p>Os indicadores do Administrador serão exibidos aqui em uma próxima etapa.</p>
      </section>
    </div>
  )
}
