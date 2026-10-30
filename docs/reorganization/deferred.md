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
