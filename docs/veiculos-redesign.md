# Redesign do módulo de Veículos

## Escopo

Evolução visual da listagem e do detalhe existente em /gestor/veiculos.
Navegação global, paleta institucional, contratos, permissões e backend preservados.
As alterações locais preexistentes foram mantidas; não houve commit, deploy ou migration.

## Componentes

- VehiclePresentation: mídia reutilizável, ilustrações SVG autorais por tipo real, badge e formatação de apresentação.
- Veiculos: indicadores, busca/filtros existentes, cards com quatro regiões e cadastro.
- VehicleDetails: identificação visual, grupos cadastrais, consultas, estados e edição.
- veiculos.service: PATCH existente com schemas de entrada/resposta e cliente comum; nenhuma mudança de contrato.

## Imagens e limites

VehicleImage aceita src opcional, carregamento lazy/eager, alternativa acessível e fallback em erro.
O DTO atual não fornece fotografia nem unidade administrativa. A aplicação usa ilustrações
locais de passeio, van, ambulância, rabecão SVO e categoria desconhecida. Não se infere
caminhonete pelo modelo de um veículo cadastrado como passeio. Não há imagem externa,
integração paga ou necessidade de bucket nesta entrega. Conectar fotografias persistentes
requer um contrato de mídia e política de armazenamento/autorizacão próprios.

Manutenção, multas e outros históricos sem consulta disponível aparecem como indisponíveis,
sem afirmar ausência de registros. Abastecimentos e documentos usam consultas reais;
loading, erro/retry e vazio confirmado são distintos. Download permanece indisponível.
A edição usa somente campos aceitos pelo PATCH existente e confirma sucesso após o servidor.

## Checklist e evidências locais

- [x] Identidade, navegação, filtros e cadastro existentes preservados.
- [x] Mídia local por categoria, erro de imagem e troca de URL cobertos.
- [x] Nomes extensos, campos nullable, status e edição confirmada cobertos.
- [x] Modais com foco, Escape, nomes acessíveis e bloqueio durante envio.
- [x] Grid considera largura disponível com container queries; tabelas mantêm rolagem interna.
- [x] Sete cenários de navegador isolados passaram (responsividade, edição e mídia).
- [x] Capturas e verificação sem overflow em 390/768/1280/1440 px.
- [x] Typecheck completo e build frontend/backend passaram.
- [x] 85 testes frontend de apresentação e serviços passaram.
- [x] ESLint dos arquivos da entrega passou.
- [ ] Lint global: bloqueado por eslint-config-next ausente em configuração dentro da pasta local .codex-erinaldo (fora do escopo).
- [ ] E2E original com backend: não iniciou porque a porta 5173 está em uso; processo alheio preservado.

Comandos reproduzíveis:

```sh
npm run typecheck
npm run build
npx vitest run --config frontend/vite.config.ts frontend/src/shared frontend/src/pages/veiculos/VehiclePresentation.test.ts
npx playwright test --config tests/ui-controls/veiculos-redesign.config.ts
```

Capturas e resultados ficam em test-results/veiculos-redesign, fora do Git.
A suíte isolada usa fixtures HTTP explicitamente em testes, sem mocks na aplicação de produção.
Build emite aviso de bundle acima de 500 kB; divisão global de código está fora deste redesign.

## Reconcilia??o com a main ? 09/11/2026

A compara??o normalizou quebras de linha e preservou corre??es posteriores da main em sidebar, dashboard, instru??es e testes. Os ajustes finais da interface e os cen?rios de edi??o e imagens foram incorporados.

No checkout isolado do PR passaram lint, typecheck, build, api:check, client:check, 86 testes frontend e os sete cen?rios Playwright isolados em 390/768/1280/1440 px. O build manteve o aviso de bundle acima de 500 kB.

A su?te completa exigiu identidade do banco isolado. O provisionamento foi recusado porque j? existe uma inst?ncia ou volume sem comprovante deste checkout. O E2E com backend n?o iniciou porque a porta 5173 estava ocupada. Nenhum processo ou banco preexistente foi alterado.
