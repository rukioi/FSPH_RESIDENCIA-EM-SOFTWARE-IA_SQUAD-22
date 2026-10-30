# Frontend

Aplicam-se as instruções da raiz.

- HTTP passa por `src/shared/services/` e `src/shared/api/client.ts`; autenticação
  reutiliza o adaptador Bearer/401. Use DTOs/bindings gerados e schemas puros para
  validar respostas, sem duplicar envelopes nas páginas ou editar gerados.
- Estado remoto comum em `useRemoteData`; filtros/modal/formulário são locais.
  Cancele/ignore leituras antigas, inclusive após escrita confirmada/desmontagem.
  Não apresente salvamento antes da confirmação nem reconstrua resposta inválida.
- Sem cliente Supabase, SQL ou persistência operacional em storage do navegador.
  Token apenas em `sessionStorage`, dados consultados pela API.
- Interface pt-BR, loading/status, erro/alert e nova tentativa acionável. Rótulos,
  foco visível, botões de ícone nomeados, menu fechado fora do foco e alvos ≥40 px.
- Reutilize CSS/tokens/componentes do módulo. A localização histórica de CSS fora
  de `app/` não autoriza reorganização em massa. Sem paleta/fonte/redesign incidental.
- Dado fictício mostra demonstração; endpoint ausente mostra indisponibilidade.
  Contadores locais do SVO são recorte da sessão, sem alegar histórico persistido.
- Alteração de tela/fluxo exige E2E isolado e capturas 390/768/1280; verifique foco,
  teclado e ausência de rolagem horizontal da página. Tabelas/modais podem conservar
  rolagem interna existente. Capturas ficam fora do Git e são evidências do PR.
