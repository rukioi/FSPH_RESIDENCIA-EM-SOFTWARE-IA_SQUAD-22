/** Converte data civil ISO em exibição brasileira, sem conversão de fuso. */
export function exibirData(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

/** Valida uma data civil, inclusive anos bissextos, e devolve ISO ou vazio. */
export function dataIso(texto: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (!match) return ''
  const [, dia, mes, ano] = match
  const y = Number(ano), m = Number(mes), d = Number(dia)
  if (y < 1 || m < 1 || m > 12 || d < 1) return ''
  const limite = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  return d <= limite ? `${ano}-${mes}-${dia}` : ''
}

/** Aplica máscara progressiva, aceitando também uma data ISO completa. */
export function mascararData(texto: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return exibirData(texto)
  const numeros = texto.replace(/\D/g, '').slice(0, 8)
  return [numeros.slice(0, 2), numeros.slice(2, 4), numeros.slice(4, 8)].filter(Boolean).join('/')
}
