const icones = {
  alerta: "M10.3 4.4a2 2 0 0 1 3.4 0l7.7 13.2a2 2 0 0 1-1.7 3H4.3a2 2 0 0 1-1.7-3z M12 9v4 M12 17h.01",
  relogio: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2",
  rota: "M4 6h13l-3-3 M20 18H7l3 3 M17 6l-3 3 M7 18l3-3 M4 5v2 M20 17v2",
  manutencao: "M14.7 6.3a5 5 0 0 0-6.3 6.3L3 18a2.1 2.1 0 0 0 3 3l5.4-5.4a5 5 0 0 0 6.3-6.3l-3 3-3-3z",
  confirmado: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M8 12l3 3 5-6",
  frota: "M5 11l1.5-5h11l1.5 5 M4 11h16a1 1 0 0 1 1 1v6H3v-6a1 1 0 0 1 1-1z M6 14h2 M16 14h2 M5 18v2 M19 18v2",
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  solicitacoes:
    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 3h6v4H9z M9 12h6 M9 16h6',
  calendario:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 2v4 M8 2v4 M3 10h18',
  veiculos: 'M3 12l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 6l2 6v7H3z M3 12h18 M6 15h2 M16 15h2 M5 19v2 M19 19v2 M1 10h3 M20 10h3',
  motoristas:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  svo: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  documentos: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  abastecimentos:
    'M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17 M3 22h12 M15 11h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3 M6 8h6',
  relatorios: 'M3 3v18h18 M8 17v-5 M13 17V8 M18 17v-8',
  auditoria: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  notificacoes: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10.3 21a2 2 0 0 0 3.4 0',
  configuracoes:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  seta: 'm6 9 6 6 6-6',
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  mais: 'M12 5v14 M5 12h14',
  editar: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  fechar: 'M18 6 6 18 M6 6l12 12',
  olho: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  olhoFechado:
    'M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2 M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9 9 0 0 0 5.4-1.6 M2 2l20 20 M14.1 14.1a3 3 0 0 1-4.2-4.2',
  email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
  cadeado: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  check: 'M20 6 9 17l-5-5',
}

export type NomeIcone = keyof typeof icones

/** ?cones vetoriais da ?rea de gest?o, com grade e tra?o consistentes. */
export function IconeGestor({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d={icones[nome]} />
    </svg>
  )
}
