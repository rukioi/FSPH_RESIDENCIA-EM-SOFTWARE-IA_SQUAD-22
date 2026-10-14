import { useState } from 'react'
import './Dashboard.css'

const periodos = ['Hoje', '7 dias', '30 dias', 'Personalizado']

export function Dashboard() {
  const [periodo, setPeriodo] = useState('Hoje')

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da operação da frota</p>
        </div>

        {/* Seletor de período */}
        <div className="periodo" role="group" aria-label="Período">
          {periodos.map((nome) => (
            <button
              key={nome}
              type="button"
              aria-pressed={periodo === nome}
              className={periodo === nome ? 'periodo__botao periodo__botao--ativo' : 'periodo__botao'}
              onClick={() => setPeriodo(nome)}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>

      {/* Espaço reservado para os próximos blocos do dashboard */}
      <section className="reservado">Os blocos do dashboard entram aqui.</section>
    </>
  )
}