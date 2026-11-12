# Abastecimentos — implementação e validação

Este documento registra a entrega anterior à reconciliação RF40. Para a Sprint 9,
consulte o [contrato atual](./api/abastecimentos.md) e a
[validação DB/BE](./database/sprint9-abastecimentos.md). Motorista/km já são opcionais
no backend isolado; a adequação da tela continua com Gustavo. Nenhuma autorização
histórica de aplicação remota abaixo se aplica ao trabalho atual.

## Escopo

Tela `/gestor/abastecimentos` para ADM e GESTOR_FROTA, integrada às APIs de
abastecimentos, veículos e motoristas. Apresenta registros, litros e valor do
recorte selecionado, filtros por datas/veículo e cadastro confirmado pelo servidor.
O formulário conserva motorista e quilometragem obrigatórios do banco atual.
Não altera odômetro, disponibilidade ou estados de outros módulos.

Tanque completo e comprovante foram autorizados como ampliação de esquema.
A migration `20261109000000_add_abastecimento_comprovante.sql` mantém registros
anteriores com tanque completo falso. Imagens JPEG/PNG de até 1 MiB ficam em
tabela separada, com RLS e sem permissões de acesso público; a API valida
assinatura, nome, MIME e tamanho. Registro e imagem compartilham uma transação.
O download exige a sessão atual e os mesmos perfis operacionais.

## Checklist de revisão

- [x] Reutilizar cliente HTTP, sessão, permissões, tipos gerados e validação JSON.
- [x] Não confirmar cadastro antes do servidor; descartar consultas anteriores.
- [x] Preservar formulário em erro e oferecer nova tentativa de consulta.
- [x] Implementar foco, teclado, bloqueio durante envio e cancelamento do download.
- [x] Verificar interface em 390, 768 e 1280 px, sem overflow da página.
- [x] Atualizar contrato do módulo e gerar API/cliente pelos comandos oficiais.
- [ ] Executar integração e E2E com PostgreSQL isolado.
- [ ] Regenerar schema, metadados e DER pelo catálogo do banco isolado.
- [x] Aplicar a migration no projeto Supabase autorizado e conferir seu catálogo.

## Evidências e limites

Os 47 testes direcionados de transporte, serviço, acesso e contrato passaram. Os três
cenários de navegador com respostas simuladas passaram e geraram capturas em
`test-results/abastecimentos-ui-mock/` (fora do Git). Essas provas não substituem
persistência em PostgreSQL. Typecheck e build passaram durante a implementação;
alterações paralelas em outros módulos exigem conferir novamente o estado final.

O harness recusou contêineres/volume locais preexistentes sem manifesto de
proveniência. O usuário recusou sua recriação e definiu uso exclusivo do Supabase.
Por sua decisão, integração/E2E com banco e geração do snapshot/DER ficam pendentes;
não remover nem utilizar esses recursos locais. As guardas não foram modificadas.
Não executar testes de inserção/exclusão no Supabase compartilhado.
O lint dos arquivos da entrega passou; o lint global também encontra uma
configuração de plugin preexistente em `.codex-erinaldo/`, que depende de pacote
externo ausente. Não instalar dependências ou alterar esse diretório para a tarefa.

A migration remota `add_abastecimento_comprovante`, versão `20261109114712`,
foi aplicada em `cocdhjzzvdjilzahryaw` após confirmação da URL e do catálogo.
A conferência posterior comprovou proprietário postgres, RLS na tabela nova,
revogações de PUBLIC/anon/authenticated e CHECK de até 1.048.576 bytes. A RLS
preexistente de abastecimento continuou habilitada, embora o snapshot histórico
local a registre desligada. Nenhuma baseline ou migration de outro módulo foi
aplicada, e não houve inserção/exclusão de dados operacionais para testar.
O histórico remoto utiliza a versão atribuída pelo MCP; não usar `db push` para
reaplicar o arquivo local como se fosse uma segunda mudança.

`GestorLayout.css` é o arquivo adicional indispensável: o nome Abastecimentos
com as ações do cabeçalho causava overflow em 390 px. O breadcrumb móvel passa a
encolher com reticências, preservando o tamanho dos botões e o restante do layout.

RLS e revogações do comprovante não corrigem as permissões históricas das demais
tabelas. Reverter código não reverte banco; não há rollback destrutivo automático
nem publicação/merge nesta entrega.
