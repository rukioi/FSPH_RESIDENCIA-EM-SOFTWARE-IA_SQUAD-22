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

BE-S8-01 (etapa inicial): GET /api/viagens/minhas é exclusivo de MOTORISTA e consulta somente viagens institucionais vinculadas ao usuário da sessão. Não concede acesso a ordens SVO nem altera permissões das solicitações.

BE-S8-01: iniciar e concluir viagens institucionais é exclusivo do MOTORISTA vinculado à viagem; acesso a viagem alheia recebe 404.

BE-S8-01: validar viagem institucional concluída é exclusivo de ADM e GESTOR_FROTA; o responsável é obtido da sessão atual.

BE-S8-01: listagem de viagens é exclusiva de ADM/GESTOR_FROTA; detalhes e histórico também permitem MOTORISTA atribuído, com 404 para viagem inacessível.

BE-S8-01: a consulta e o download de evidências institucionais permitem ADM, GESTOR_FROTA e MOTORISTA atribuído; evidência ou viagem inacessível retorna 404. A foto operacional obrigatória é enviada somente pelo motorista atribuído, junto ao início ou à conclusão da viagem.

BE-S8-01: corrigir quilometragem de viagem concluída e consultar as versões da correção são ações exclusivas de ADM/GESTOR_FROTA.
