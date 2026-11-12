# Permissões

Esta é a referência de acesso implementado. A matriz descreve a API atual;
novas permissões e reconciliações de negócio exigem tarefa própria.

## Padrão inicial

- Negue operações protegidas sem autorização explícita.
- Valide no backend a identidade, a ação permitida e o acesso ao registro. Conhecer um ID não concede acesso.
- Reutilize o mecanismo em `backend/src/security/` e os middlewares comuns. A regra específica do recurso permanece no módulo responsável.
- O frontend pode esconder ações indisponíveis, mas não decide a autorização.
- Aplique o mesmo controle a listas, detalhes, alterações e downloads.

Esses princípios seguem a orientação de [autorização da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Matriz atual

| Área de visualização | Ações e registros acessíveis |
| --- | --- |
| Administrador (`ADM`) | Dashboard administrativo, gestão de usuários e auditoria; também pode acessar as operações de gestor permitidas no backend. |
| Gestor (`GESTOR_FROTA`) | Dashboard, veículos, motoristas, documentos e abastecimentos. Não gerencia usuários nem acessa auditoria administrativa. |
| Responsável SVO (`ATENDENTE_SVO`) | Consulta veículos e motoristas e acessa as rotas operacionais do SVO conforme os endpoints implementados. |
| Motorista e solicitante | Sem rotas frontend autenticadas disponíveis nesta entrega. |

As regras são aplicadas no backend; o guarda de rotas no frontend melhora a navegação, mas não substitui autorização da API. Perfis sem tela inicial configurada não recebem acesso por fallback a páginas administrativas.

## Ao entregar uma funcionalidade

SCRUM-194: anexos reutilizam sessão atual e o escopo do registro. A matriz de
upload/listagem/download está em [anexos](./api/anexos.md). Solicitação de outro
solicitante ou viagem/ordem de outro motorista retorna 404; perfil sem acesso ao
domínio retorna 403. Consulta da frota por SVO não concede acesso documental.
Não há DELETE nem edição de CNH por motorista.

SCRUM-196: notas usam o mesmo escopo por registro dos anexos, limitado a solicitações,
viagens, ordens e veículos; autor/instante são do servidor, sem edição/exclusão.
SCRUM-193: consulta/detalhe/edição versionada/histórico documental e CNH permanecem
ADM/GESTOR_FROTA. Não concede CNH ao SVO nem edição ao motorista.
SCRUM-195: somente o GET `/api/dashboard` passa a aceitar ATENDENTE_SVO com visão
SVO isolada; os endpoints administrativos de dashboard continuam restritos à gestão.

SCRUM-137: POST /api/solicitacoes-viagem é exclusivo de SOLICITANTE_INTERNO.
GET permite SOLICITANTE_INTERNO somente nos próprios pedidos e ADM/GESTOR_FROTA
em todos os pedidos, incluindo nome/ID do solicitante. ATENDENTE_SVO e MOTORISTA
não acessam esse recurso. Não há endpoint de cancelamento.
As novas permissões de API não criam páginas frontend para o solicitante.

SCRUM-138: somente ADM/GESTOR_FROTA aprovam ou rejeitam solicitações PENDENTE.
Solicitante, MOTORISTA e ATENDENTE_SVO não decidem. Cada decisão registra o ator
da sessão em log_atividade na mesma transação; decisão repetida recebe 409.

SCRUM-139: somente ADM/GESTOR_FROTA agendam solicitações APROVADA, atribuindo
motorista, veículo e retorno previsto. Atendente SVO continua despachando sem
aprovação administrativa, mas ambos os fluxos respeitam reservas compartilhadas.

SCRUM-155: somente ADM/GESTOR_FROTA editam origem, destino, finalidade, saída e
passageiros via PATCH. PENDENTE permanece; APROVADA retorna a PENDENTE para nova
análise. Demais estados: 409. Solicitante não edita. Recursos e retorno previsto
não são aceitos; edição e atividade do ator atual confirmam atomicamente.

SCRUM-156: somente ADM/GESTOR_FROTA consultam agenda/disponibilidade e reagendam
pedidos AGENDADA, mantendo esse estado. Os demais perfis não ganham acesso.
Consultas retornam somente dados operacionais mínimos; reserva e auditoria da
troca são atômicas e revalidam os dois fluxos sob bloqueio de recursos.

SCRUM-157: detalhes/histórico permitem ADM/GESTOR_FROTA em qualquer pedido;
SOLICITANTE_INTERNO somente nos próprios. Inexistente ou inacessível: mesmo404.
Responsável interno da atividade é omitido para solicitantes. Nenhum acesso novo
para MOTORISTA/ATENDENTE_SVO; sem email/CPF/telefone/CNH nos DTOs dessas consultas.

Registre aqui quem pode fazer o quê e em quais registros; implemente e teste no mesmo PR. Apenas o acesso ainda indefinido precisa de confirmação — não é necessário preencher toda a matriz antes de trabalhar.

Organizações, vínculos e múltiplos papéis só entram no modelo se houver necessidade confirmada.

## Preservação da matriz — #29

Todas as rotas protegidas consultam usuário ativo e perfil efetivo atual do banco.
Ausência/invalidade de sessão, usuário inexistente ou inativo: 401; perfil atual
fora da lista explícita: 403. Sessão aceita os cinco perfis reais, incluindo
SOLICITANTE_INTERNO; não dá página inicial administrativa a motorista/solicitante.

O documento de requisitos trata ADM/Gestor como equivalentes operacionais.
Reconciliar essa definição é tarefa funcional futura: nesta refatoração usuários
e auditoria continuam somente ADM; SVO continua somente ATENDENTE_SVO; dashboard,
documentos e abastecimentos ADM/GESTOR_FROTA; veículos/motoristas permitem também
ATENDENTE_SVO apenas para consulta. Não há fallback administrativo ou multitenancy.
O frontend mantém as restrições de navegação já existentes.

SCRUM-164: /api/dashboard/gestor e /api/dashboard/graficos permanecem restritos
a ADM/GESTOR_FROTA, sem acesso de solicitante/motorista/SVO. Período e indicadores
não alteram o escopo das solicitações individuais nem autorizam escrita em logs.
