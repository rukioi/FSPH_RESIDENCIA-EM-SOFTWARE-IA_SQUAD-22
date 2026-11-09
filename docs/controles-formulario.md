# Calendários e dropdowns compartilhados

## Escopo

Padronização dos nove campos de data e 21 seletores existentes no frontend:
Abastecimentos, Dashboard do Gestor, Solicitações, Minhas Solicitações, formulário
de solicitação, Motoristas, Veículos, Auditoria, Usuários e despacho SVO.
O calendário de agenda continua com sua visualização própria; menus de ações e
navegação em detalhes não fazem parte desta alteração, conforme esclarecimento
do usuário.

## Uso e contrato

`shared/components/DatePicker` recebe os atributos de um input. O valor inicial,
`onChange` e `FormData` usam `YYYY-MM-DD`; o campo visível usa `dd/mm/aaaa`.
Aceita digitação e colagem, valida calendário civil e anos bissextos sem converter
fuso, respeita `min`, `max`, `required`, `disabled` e `readOnly`. O calendário
em português permite escolher dia, mudar mês/ano, retornar a Hoje e limpar campos
opcionais. Datas inválidas impedem envio nativo e não são convertidas em outra data.

`shared/components/Select` recebe os atributos de um select de escolha única e
seus elementos `option`/`optgroup`. Conserva valores, callbacks, envio, reset e
validação do formulário; apresenta lista própria, opção selecionada, opções
desabilitadas e mensagem para campo obrigatório. A lista aceita setas, início/fim,
busca por digitação, Enter/Espaço, Escape e Tab.

Os painéis usam a camada superior do navegador e posicionamento limitado ao
viewport, inclusive dentro de `dialog`, evitando cortes por tabelas e containers
com rolagem. O foco é devolvido ao controle ao selecionar ou fechar por Escape;
os painéis fecham ao clicar ou mover o foco para fora.

Não houve mudança de API, permissões, banco ou persistência. Os componentes usam
os tokens existentes e não adicionam dependências. O select nativo interno fica
visualmente oculto para conservar o contrato de formulários, com interação pelo
controle acessível próprio.

## Checklist e verificação

- [x] Inventariar e migrar todos os inputs de data e selects do código da aplicação.
- [x] Manter valores ISO e códigos das opções enviados aos serviços existentes.
- [x] Cobrir datas impossíveis, limites, campos controlados e não controlados.
- [x] Cobrir formulário obrigatório, reset, bloqueio por fieldset e navegação por teclado.
- [x] Verificar painéis em modal nas larguras 390, 768 e 1280 px.
- [x] Atualizar os E2Es existentes para interagir com a lista visível.

`npm run test:ui-controls` inicia apenas Vite e Chromium, sem backend, credenciais
ou banco. As fixtures e respostas simuladas existem somente em `tests/ui-controls`;
nenhum dado fictício foi adicionado à aplicação. As capturas ficam em
`test-results/ui-controls/`, fora do Git. Os testes usuais dependentes do harness
de PostgreSQL não são executados, respeitando a opção do usuário por não utilizar
banco local.

Os testes de `shared/components/datas.test.ts` podem ser executados com configuração
Vitest independente do harness de banco. Typecheck, build e lint dos arquivos
alterados complementam os testes de interação.
