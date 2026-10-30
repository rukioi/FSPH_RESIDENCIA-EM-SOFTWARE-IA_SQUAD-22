# Backend

Aplicam-se as instruções da raiz. O caminho ativo é `node:http`, não Express.

- `server.ts` carrega configuração antes de importar app; `app.ts` despacha pelo
  registro de contratos e pathname. Não leia configuração existente em tarefas.
- Pool único em `src/database/connection.ts`; `config/db.ts` só reexporta esse pool.
  TLS verifica cadeia/hostname. Não introduza outro cliente ou fallback inseguro.
- JWT, sessão atual e autorização em `src/security/`; 401 para sessão inválida ou
  conta inativa, 403 para perfil efetivo não permitido. Não autorize pelo claim antigo.
- HTTP/corpos/erros/request ID/logger em `src/shared/`. Sem payload privado no log.
- Contratos Zod puros em `src/modules/*/*.schemas.ts` e registro global. Atualize
  contrato Markdown junto do endpoint. Não importar pool/dotenv em geradores.
- Negócio no módulo; SQL parametrizado no repositório onde já separado. Auditoria
  recebe a transação do chamador; falha de atividade reverte a operação existente.
- Use apenas o harness confirmado para testes reais. Sem URL arbitrária, DDL remoto,
  reset/repair ou seed fora do isolado. Nova migration só com escopo explícito;
  regenere schema/metadados/DER e execute checks/testes.
- API alterada exige integração com autenticação, autorização, validação e caminho
  feliz no banco isolado. Sem mock como prova de integridade. Preserve contratos e
  permissões atuais, inclusive exceções legadas documentadas.
