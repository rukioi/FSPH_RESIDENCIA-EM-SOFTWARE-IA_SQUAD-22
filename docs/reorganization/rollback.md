# Retorno de código e banco — #33

## Código

O responsável decide o merge do PR único #34. Antes de rollout, guardar a revisão
anterior, conferir configuração/TLS e JWT_SECRET ≥32 bytes e executar os checks do
checkout escolhido. Troca de segredo invalida tokens anteriores e exige novo login.
PATCH de status agora exige `{ativo:boolean}`; servidor e cliente devem ser publicados
juntos. Não executar o frontend novo com servidor anterior nesse fluxo.

Se optar por squash, reverter o commit agregado em nova branch/PR facilita o retorno
do código. Sem squash, revisar o conjunto completo dos commits #27–#33; não reverter
isoladamente dependências compartilhadas. O responsável confirma a versão e aplica
o processo de publicação fora desta tarefa. Não há deploy ou revert automático aqui.

## Banco, permissões e dados

Git revert não desfaz migrations, ACL/RLS ou dados. A baseline #27 é reprodução do
catálogo auditado em banco vazio isolado, não migration de atualização do Supabase
existente. Não aplicar sobre produção, nem fazer down, DROP, reset ou repair.
A #33 não adiciona migration; #28–#32 preservam esquema/histórico e semântica temporal.

O novo código deve funcionar sobre o esquema auditado; o retorno de código conserva
esse esquema. Antes de qualquer futura migration remota, o responsável precisa
aprovar reconciliação, compatibilidade com as duas revisões, backup/recuperação e ACL
do papel real. ACL ensaiada localmente com papel fictício não é rollout remoto.

## Ensaio isolado

O harness verifica container/checkout/porta/marcador antes de acesso. Usar apenas
fixtures e banco fsph_t1_baseline, sem apontar revisão antiga a URL arbitrária.
O ensaio desta consolidação executa a revisão anterior à #33 contra o mesmo esquema
isolado e verifica a aplicação/contratos antes de restaurar o checkout atual.
Resultados e limitações ficam na [validação](./validation.md). Não comprova rollback
operacional publicado, recuperação de backup ou segurança da Data API remota.
