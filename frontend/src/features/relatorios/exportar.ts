import type { Relatorio } from '../../shared/services/relatorios.service';

/** Formata datas civis sem aplicar o fuso do navegador nem deslocar o dia. */
export function formatarCelula(valor: string | number | null | undefined, tipo: string): string {
  if (valor === null || valor === undefined) return '—';
  if (tipo === 'data' || tipo === 'dataHora') {
    const texto = String(valor);
    const data = `${texto.slice(8,10)}/${texto.slice(5,7)}/${texto.slice(0,4)}`;
    return tipo === 'dataHora' ? `${data} ${texto.slice(11,16)}` : data;
  }
  return typeof valor === 'number' ? new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 6}).format(valor) : valor;
}

/** Protege células textuais contra fórmulas e mantém aspas/quebras de linha no CSV. */
export function celulaCsv(valor: string | number | null | undefined): string {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  const primeiro = [...texto].find(char => char.charCodeAt(0)>31 && !/\s/.test(char));
  if (typeof valor !== 'number' && primeiro && '=+@-'.includes(primeiro)) texto = "'" + texto;
  return '"' + texto.replaceAll('"','""') + '"';
}

/** CSV completo em UTF-8/BOM, separado por ponto e vírgula para planilhas pt-BR. */
export function gerarCsv(relatorio: Relatorio): string {
  return '\uFEFF' + [relatorio.colunas.map(c => celulaCsv(c.titulo)).join(';'),
    ...relatorio.linhas.map(linha => relatorio.colunas.map(c => {
      const valor = linha[c.chave];
      return celulaCsv(c.tipo === 'data' || c.tipo === 'dataHora' ? valor == null ? null : formatarCelula(valor,c.tipo) : typeof valor === 'number' ? String(valor).replace('.',',') : valor);
    }).join(';'))].join('\r\n') + '\r\n';
}

function metadados(r: Relatorio): string[] {
  return [`Período: ${formatarCelula(r.inicio,'data')} a ${formatarCelula(r.fim,'data')} (inclusivo)`,
    `Critério: ${r.criterioPeriodo}`,
    `Veículo ID: ${r.filtros.veiculoId ?? 'Todos'} | Motorista ID: ${r.filtros.motoristaId ?? 'Todos'} | Status: ${r.filtros.status ?? 'Todos'}`,
    `Gerado em: ${new Date(r.geradoEm).toLocaleString('pt-BR',{timeZone:'America/Maceio'})} (America/Maceio) | Registros: ${r.resumo.registros}`,
    ...(r.resumo.semQuilometragem !== null ? [`Km concluídos informados: ${r.resumo.kmConcluidos ?? 'Não informado'} | Concluídas sem km válido: ${r.resumo.semQuilometragem}`] : []),
    ...r.observacoes];
}

/** Gera XLSX real, com valores numéricos, cabeçalho fixo e contexto em aba própria. */
export async function gerarXlsx(r: Relatorio): Promise<Blob> {
  const {default: ExcelJS} = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FSPH — Gestão de Frotas';
  workbook.created = new Date(r.geradoEm);
  const contexto = workbook.addWorksheet('Informações');
  contexto.columns = [{width: 120}];
  contexto.addRows([[r.titulo],...metadados(r).map(texto => [texto])]);
  contexto.eachRow(row => {row.alignment = {wrapText:true, vertical:'top'}; row.height = 36;});
  const tabela = workbook.addWorksheet('Dados', {views:[{state:'frozen',ySplit:1}]});
  tabela.columns = r.colunas.map(c => ({header:c.titulo,key:c.chave,width:c.chave==='justificativa'?65:24}));
  for (const linha of r.linhas) tabela.addRow(r.colunas.map(c => {
    const valor = linha[c.chave];
    return valor == null ? null : c.tipo === 'data' || c.tipo === 'dataHora' ? formatarCelula(valor,c.tipo) : valor;
  }));
  tabela.autoFilter = {from:{row:1,column:1},to:{row:1,column:r.colunas.length}};
  tabela.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
  tabela.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF0A2F5E'}};
  tabela.eachRow(row => {row.alignment = {wrapText:true,vertical:'top'};});
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/** PDF paginado com contexto, cabeçalhos repetidos e quebra de texto sem cortar registros. */
export async function gerarPdf(r: Relatorio): Promise<Blob> {
  const [{jsPDF},{autoTable}] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc = new jsPDF({orientation:'landscape',format:r.colunas.length>10?'a3':'a4'});
  doc.setProperties({title:r.titulo,author:'FSPH — Gestão de Frotas'});
  doc.setFontSize(15); doc.text(r.titulo,12,14);
  doc.setFontSize(9);
  const contexto = doc.splitTextToSize(metadados(r).join('\n'),doc.internal.pageSize.getWidth()-24) as string[];
  doc.text(contexto,12,22);
  autoTable(doc, {
    startY:26+contexto.length*4, margin:{top:15,right:12,bottom:15,left:12},
    head:[r.colunas.map(c=>c.titulo)],
    body:r.linhas.map(linha=>r.colunas.map(c=>formatarCelula(linha[c.chave],c.tipo))),
    styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},
    headStyles:{fillColor:[10,47,94]}, showHead:'everyPage',
    didDrawPage: ({pageNumber}) => {doc.setFontSize(8);doc.text(`FSPH | ${r.titulo} | Página ${pageNumber}`,12,doc.internal.pageSize.getHeight()-7);},
  });
  return doc.output('blob');
}

/** Baixa o snapshot consultado; nunca limita a exportação à página visível. */
export async function exportarRelatorio(r: Relatorio, formato: 'csv'|'xlsx'|'pdf', signal?: AbortSignal): Promise<void> {
  const blob = formato === 'csv' ? new Blob([gerarCsv(r)],{type:'text/csv;charset=utf-8'}) : formato === 'xlsx' ? await gerarXlsx(r) : await gerarPdf(r);
  signal?.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `relatorio-${r.tipo}-${r.inicio}-${r.fim}.${formato}`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
