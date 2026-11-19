import { expect, test } from 'vitest';
import ExcelJS from 'exceljs';
import { celulaCsv, formatarCelula, gerarCsv, gerarPdf, gerarXlsx } from './exportar';
import type { Relatorio } from '../../shared/services/relatorios.service';

const relatorio: Relatorio = {
  tipo:'viagens',titulo:'Viagens — validação',inicio:'2026-01-01',fim:'2026-01-31',
  criterioPeriodo:'Início real da viagem.',geradoEm:'2026-02-01T12:00:00Z',observacoes:['Somente registros existentes.'],
  filtros:{veiculoId:'9007199254740993',motoristaId:null,status:'CONCLUIDA'},
  colunas:[{chave:'id',titulo:'Identificador',tipo:'texto'},{chave:'data',titulo:'Data',tipo:'dataHora'},{chave:'km',titulo:'Km',tipo:'numero'},{chave:'nota',titulo:'Justificativa',tipo:'texto'}],
  linhas:Array.from({length:80},(_,i)=>({id:String(9007199254740993n+BigInt(i)),data:'2026-01-15T23:30:00',km:i===0?null:i,nota:i===0?'=SUM(A1:A2)':'Correção de odômetro; texto "conferido"\nSegunda linha'})),
  resumo:{registros:80,kmConcluidos:3160,semQuilometragem:1},
};
test.each(['=1+1',' +cmd','\t@SUM(A1)','-1+2'])('escapa fórmulas em CSV: %s',valor=>expect(celulaCsv(valor)).toBe('"\''+valor+'"'));
test('CSV inclui todas as linhas, conserva ID/aspas/acentos e não transforma null em zero',()=>{
  const csv=gerarCsv(relatorio);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('9007199254740993');
  expect(csv).toContain('"\'=SUM(A1:A2)"');
  expect(csv).toContain('"15/01/2026 23:30";""');
  expect(csv).toContain('texto ""conferido""');
  expect(csv).toContain(relatorio.linhas[79].id);
});
test('datas civis preservam dia/horário e zero continua distinto de ausência',()=>{
  expect(formatarCelula('2026-01-15T23:30:00','dataHora')).toBe('15/01/2026 23:30');
  expect(formatarCelula(null,'numero')).toBe('—');
  expect(formatarCelula(0,'numero')).toBe('0');
});
test('XLSX real pode ser reaberto com dados completos, números e contexto',async()=>{
  const blob=await gerarXlsx(relatorio);
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await blob.arrayBuffer()) as never);
  const sheet=workbook.getWorksheet('Dados')!;
  expect(sheet.rowCount).toBe(81);
  expect(sheet.getCell('A2').value).toBe('9007199254740993');
  expect(sheet.getCell('C2').value).toBeNull();
  expect(sheet.getCell('C3').value).toBe(1);
  expect(sheet.getCell('D2').value).toBe('=SUM(A1:A2)');
  expect(workbook.getWorksheet('Informações')!.getCell('A4').text).toContain('9007199254740993');
});
test('PDF é válido, tem paginação e mantém a última linha do relatório',async()=>{
  const blob=await gerarPdf(relatorio);
  const text=Buffer.from(await blob.arrayBuffer()).toString('latin1');
  expect(text.startsWith('%PDF-')).toBe(true);
  expect(text.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  expect(text).toContain(String(relatorio.linhas[79].id));
  expect(text).toContain('2026');
});
