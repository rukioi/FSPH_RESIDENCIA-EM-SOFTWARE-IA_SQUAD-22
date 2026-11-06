const cores: Record<string, string> = {
  PENDENTE: '#c98200', APROVADA: '#21864b', AGENDADA: '#5c9bdd',
  PRONTA_PARA_INICIAR: '#168580', EM_ANDAMENTO: '#2866c7', CONCLUIDA: '#21864b',
  REPROVADA: '#d52b36', CANCELADA: '#64748b', DISPONIVEL: '#21864b',
  EM_VIAGEM: '#2866c7', EM_MANUTENCAO: '#c98200', INDISPONIVEL: '#64748b',
};

/** Distribuição completa dos estados recebidos da API, incluindo estados legados. */
export function DistribuicaoGestor({ itens, frota = false }: {
  itens: Array<{ status: string | null; total: number }>; frota?: boolean;
}) {
  const total = itens.reduce((soma, item) => soma + item.total, 0);
  let acumulado = 0;
  const gradiente = itens.filter(item => item.total > 0).map(item => {
    const inicio = acumulado;
    acumulado += item.total / total * 100;
    return `${cores[item.status ?? ''] ?? '#64748b'} ${inicio}% ${acumulado}%`;
  }).join(', ');
  return <div className={frota ? 'gestor-distribuicao gestor-distribuicao--frota' : 'gestor-distribuicao'}>
    {!frota && <div className="gestor-donut" style={{ background: total ? `conic-gradient(${gradiente})` : '#edf1f5' }} role="img" aria-label={`${total} chamados no período`}><div><strong>{total}</strong><small>chamados</small></div></div>}
    <ul className="gestor-legenda">{itens.length ? itens.map((item, i) => <li key={i}>
      <div><span className="gestor-ponto" style={{ background: cores[item.status ?? ''] ?? '#64748b' }} /><span>{item.status ? item.status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR') : 'Não informado'}</span><strong>{item.total}</strong></div>
      {frota && <div className="gestor-barra" aria-hidden="true"><span style={{ width: `${total ? item.total / total * 100 : 0}%`, background: cores[item.status ?? ''] ?? '#64748b' }} /></div>}
    </li>) : <li>Nenhum registro encontrado.</li>}</ul>
  </div>;
}
