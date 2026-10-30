# Divergências preservadas — #28

Registro exigido pela coordenação #22; este arquivo adicional ao rol de caminhos
é necessário para cumprir a instrução explícita de não resolver domínio durante
a refatoração técnica. Nada abaixo foi implementado ou alterado pela #28.

- Dashboard /gestor chama contagem total de motoristas de motoristasDisponiveis;
  /dashboard/kpis não existe. Não adicionar indicador nem redefinir disponibilidade.
- Abastecimento admite omitir motorista_id/quilometragem no controller, enquanto
  a baseline auditada exige ambos. RF40 e a obrigatoriedade precisam de tarefa própria.
- SVO expõe filtro AGUARDANDO_DESPACHO e persiste PENDENTE_ALOCACAO; despacho verifica
  apenas o conflito operacional já existente, sem disponibilidade unificada com viagens.
- IDs negativos das fixtures #27 servem à prova isolada; a rota SVO continua
  exigindo identidade positiva, como antes. Não mudar essa regra para acomodar fixtures.
- Segurança de sessões, perfil efetivo/usuário ativo, tamanho de JWT_SECRET e
  autorização são da #29. Transações/gravação da auditoria existente são da #31.
- Envelopes diretos/data/erro, snake_case, listas sem paginação e serialização
  temporal/numérica legada ficam para #32; nenhuma conversão de histórico.
- ACL/RLS reproduzidas em #27 não comprovam proteção da Data API compartilhada.
  Nenhuma alteração remota está autorizada por esta entrega.
- Agenda/reservas, triagem/IML, novos estados/perfis, notificações, manutenção e
  regras pendentes #23–#26 continuam fora desta refatoração.

Sequência: #27 → #28 → #29 → #31 → #32 → #30 → #33. Somente #33 abre o PR final.

## Atualização #29

- Requisitos tratam ADM/Gestor como equivalentes operacionais; a matriz existente
  foi preservada. Reconciliação funcional futura, sem novos acessos nesta tarefa.
- Papel runtime remoto, memberships e schemas expostos da Data API não foram
  confirmados. Sem migration ACL ou escrita remota; estratégia mínima ensaiada
  no isolado com rollback. A baseline mantém grants amplos até rollout aprovado.
- Revogação avançada/refresh/cache/token_version permanecem fora; estado ativo e
  perfil efetivo passam a ser consultados por requisição. Operações já autorizadas
  não são interrompidas por uma mudança posterior no banco.
- Cadastro/edição mantêm auditoria legada fora da transação; centralização #31.
  Status já é atômico/idempotente para evitar eventos duplicados por repetição.
- Envelopes e DTOs atuais continuam para #32; nenhum DTO HTTP novo foi duplicado
  no frontend. O modelo visual continua usando rótulos; API/SQL usam enum real.

Próximo ticket: #31. Somente #33 abre/reutiliza o PR final.

- O painel visual preexistente PermissoesPerfil não configura a autorização da API;
  a fonte continua sendo a lista explícita do backend. Nenhuma permissão nova foi
  persistida ou tornada configurável nesta tarefa. Essa reconciliação é futura.
- Em 390 px a tabela de usuários conserva rolagem interna preexistente; a página
  não tem rolagem horizontal. Não houve redesign/CSS fora do escopo da #29.
