# Sprint 9 — base documental e evidências (SCRUM-192)

Escopo: [SCRUM-182](https://unit-tiradentes.atlassian.net/browse/SCRUM-182),
[SCRUM-192](https://unit-tiradentes.atlassian.net/browse/SCRUM-192) e dependências
da [SCRUM-183](https://unit-tiradentes.atlassian.net/browse/SCRUM-183).
Esta entrega inclui a migration, a reversão, os artefatos de catálogo e os testes de banco.

## Inventário e compatibilidade

| Estrutura existente | O que já existe | Lacuna confirmada |
| --- | --- | --- |
| `documento_veiculo` | Veículo, tipo, validade civil e arquivo BYTEA opcional; POST JSON/multipart e listagem | Sem versão, autor/instante de alteração ou download compartilhado autorizado |
| `motorista` | CNH/categoria/validade, mantidas pelo cadastro da gestão | Sem histórico documental; motorista não ganha edição da própria CNH |
| `abastecimento_comprovante` | JPEG/PNG até 1 MiB, bytes vinculados ao abastecimento e download protegido | Contrato legado não satisfaz sozinho SCRUM-187/194 |
| `viagem_evidencia` | Foto inicial/final versionada, autoria e bytes privados | Preservar regras S8; integração compartilhada pertence à SCRUM-194 |
| `ordem_coleta` | Referências textuais de fotos | Não equivalem a evidências privadas validadas |
| `notificacao` | Destinatário e chave única, leitura e sincronização existente | Regra nova RF46 depende de decisão; não criar outro mecanismo de avisos |

A migration é **aditiva**: não reescreve bytes, CNHs, tabelas legadas, autores,
datas ou notificações. Não copia arquivos antigos para preencher uma timeline
artificial. Os novos vínculos não substituem os contratos antigos nesta etapa.

## Modelo implementado

`anexo` guarda arquivo e metadados na mesma transação PostgreSQL, aproveitando a
estratégia BYTEA já usada no projeto. Não depende de disco efêmero, bucket novo,
credencial adicional ou URL pública. A chave UUID identifica o objeto privado;
conhecê-la não concede acesso. SHA-256 e tamanho precisam corresponder aos bytes.
O limite técnico comum é 5 MiB, com assinatura PDF/JPEG/PNG, conforme o upload
de documentos existente. As APIs poderão manter limites menores de cada domínio.
Assinatura não equivale a antivírus nem à decodificação integral do documento.

Cada anexo referencia **exatamente um** registro por FK explícita: solicitação
de viagem, solicitação SVO, viagem, ordem de coleta, abastecimento, veículo,
motorista ou documento de veículo. Não há par tipo/ID sem integridade referencial.
Bytes iguais em registros diferentes continuam com chaves/vínculos distintos;
não há deduplicação global que permita inferir ou acessar o arquivo de outro usuário.

`documento_historico` registra versões de documento veicular ou CNH: validade
civil, campos documentais mínimos, autor e instante com fuso. A combinação
registro/versão é única. FKs compostas impedem associar à versão o anexo de outro
documento/motorista. O cadastro atual continua em suas tabelas existentes.
Na SCRUM-193, escrita do cadastro e inclusão da versão deverão compartilhar
transação, bloqueio e conferência de versão. A tabela sozinha não captura as
escritas legadas automaticamente. Nenhum autor/instante antigo foi inventado.

`anotacao` prepara RF48 com texto de até 2.000 caracteres, autor, instante e uma
FK para solicitação, viagem, ordem ou veículo. Não muda estado/decisão do registro.
As regras de autoria, leitura e validação HTTP serão implementadas na SCRUM-196.

Índices por vínculo/instante/ID suportam leitura determinística dos anexos/notas.
Índices de validade preservam datas civis nas tabelas existentes; não materializam
contadores, não escolhem janelas RF46 nem inferem fuso dos timestamps legados.

## Segurança e limites

As três tabelas têm RLS habilitada sem policies públicas, revogação de grants de
PUBLIC/anon/authenticated e revogação de UPDATE/DELETE/TRUNCATE de postgres e
service_role. Assim como na entrega S8, o histórico é append-only para esses
papéis. O proprietário e administradores do banco continuam capazes de manutenção;
não se afirma imutabilidade contra superusuário.

A proteção direta do banco **não substitui RBAC por registro na API**. A SCRUM-194
deverá validar sessão atual, perfil, vínculo e ação a cada upload/listagem/download;
a SCRUM-193 preservará CNH pela gestão; a SCRUM-196 aplicará o mesmo escopo às
notas. Nenhuma permissão HTTP foi ampliada nesta migration. Antes de rollout,
confirmar o papel runtime e a exposição Data API como exige `docs/seguranca.md`.

## Validade civil e alertas RF46

Os índices de `documento_veiculo.data_vencimento` e `motorista.validade_cnh`
permitem consultar os vencimentos atuais. Os dados para o dashboard continuam
nas tabelas de origem. O Jira pede um mês, uma semana e o dia do vencimento.
A automação depende da definição de mês, fuso e disparo/deduplicação na
SCRUM-193. A migration preserva as consultas e notificações existentes.

## Migration, reversão e testes

A migration `20261112000000_db_s9_02_documentos_evidencias.sql` e o rollback
homônimo ficam em `backend/src/database/supabase/`. A reversão exige
transação, bloqueia as três tabelas e recusa a operação se alguma contiver
dados. Após as APIs começarem a escrever, preservar os dados e coordenar a
retirada dessas APIs antes de considerar um rollback.

A versão documental é independente da versão de abastecimentos do PR #63.
A FK de abastecimento referencia a tabela já disponível na main. A migration
não modifica os seeds.

O teste `backend/tests/database/documentos-evidencias-s9.test.ts` roda pelo
harness PostgreSQL isolado e cobre os oito vínculos, arquivos iguais em
registros distintos, FK inválida, validações de bytes, versões, datas civis,
ACL/RLS, rejeição de rollback com dados e reaplicação sem perda de cadastros.
As verificações de acesso HTTP por usuário continuam nas SCRUM-193/194/196.
