# Inventário da API atual — #32

Gerado por api:generate; não editar manualmente. 29 operações.

| Método | Caminho | Perfis | Entrada | Sucesso | Erros | Runtime | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | /api/auth/login | pública | Credenciais | 200 Login | 400, 401, 413, 415, 429, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/auth/sessao | ADM, GESTOR_FROTA, ATENDENTE_SVO, MOTORISTA, SOLICITANTE_INTERNO | sem corpo | 200 Sessao | 401, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/admin/usuarios | ADM | sem corpo | 200 Usuarios | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| POST | /api/admin/usuarios | ADM | CriarUsuario | 201 Usuario | 400, 413, 415, 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| PUT | /api/admin/usuarios/{id} | ADM | EditarUsuario | 200 Usuario | 400, 401, 403, 404, 413, 415, 500, 405 | legado | PUT parcial. Barra final opcional. |
| PATCH | /api/admin/usuarios/{id}/status | ADM | StatusUsuario | 200 UsuarioStatus | 400, 401, 403, 404, 413, 415, 500, 405 | legado | Estado explícito idempotente; barra final opcional. |
| GET | /api/admin/auditoria/logs | ADM | sem corpo | 200 Auditoria | 400, 401, 403, 500, 405 | legado | Sem page/limit retorna array legado com email. Com qualquer parâmetro de paginação retorna DTO mínimo; defaults page=1, limit=20, max=100. Duplicatas/offset inseguro:400. |
| GET | /api/dashboard | ADM, GESTOR_FROTA | sem corpo | 200 Dashboard | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/dashboard/graficos | ADM, GESTOR_FROTA | sem corpo | 200 Graficos | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/dashboard/pendencias | ADM, GESTOR_FROTA | sem corpo | 200 PendenciasDashboard | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/dashboard/gestor | ADM, GESTOR_FROTA | sem corpo | 200 DashboardGestor | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/svo/ordens-coleta | ATENDENTE_SVO | sem corpo | 200 OrdensSvo | 400, 401, 403, 500, 405 | legado | status público AGUARDANDO_DESPACHO consulta PENDENTE_ALOCACAO no banco. Array direto; sem paginação. |
| POST | /api/svo/solicitacoes | ATENDENTE_SVO | CriarSolicitacaoSvo | 201 SolicitacaoSvo | 400, 413, 415, 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| PATCH | /api/svo/ordens-coleta/{id}/despachar | ATENDENTE_SVO | DespacharSvo | 200 OrdemDespachada | 400, 401, 403, 404, 409, 413, 415, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/veiculos | ADM, GESTOR_FROTA, ATENDENTE_SVO | sem corpo | 200 ListaVeiculos | 401, 403, 500, 405 | piloto | Lista completa id DESC, sem paginação. Piloto validado em runtime. |
| POST | /api/veiculos | ADM, GESTOR_FROTA | CriarVeiculo | 201 RespostaVeiculo | 400, 401, 403, 409, 413, 415, 500, 405 | piloto | Formato atual preservado; query params não declarados são ignorados. |
| PUT | /api/veiculos/{id} | ADM, GESTOR_FROTA | EditarVeiculo | 200 RespostaVeiculo | 400, 401, 403, 404, 409, 413, 415, 500, 405 | piloto | Alteração parcial; campos não suportados ignorados. Sem mudança de estados/disponibilidade. |
| PATCH | /api/veiculos/{id} | ADM, GESTOR_FROTA | EditarVeiculo | 200 RespostaVeiculo | 400, 401, 403, 404, 409, 413, 415, 500, 405 | piloto | Alteração parcial; campos não suportados ignorados. Sem mudança de estados/disponibilidade. |
| DELETE | /api/veiculos/{id} | ADM, GESTOR_FROTA | sem corpo | 200 ExclusaoVeiculo | 401, 403, 404, 500, 405 | piloto | 200 com data.success; FK 23503 ainda recebe 500 legado, não 409. |
| GET | /api/motoristas | ADM, GESTOR_FROTA, ATENDENTE_SVO | sem corpo | 200 Motoristas | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| POST | /api/motoristas | ADM, GESTOR_FROTA | CriarMotorista | 201 RespostaMotorista | 400, 401, 403, 409, 413, 415, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| PUT | /api/motoristas/{id} | ADM, GESTOR_FROTA | EditarMotorista | 200 RespostaMotorista | 400, 401, 403, 404, 409, 413, 415, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| PATCH | /api/motoristas/{id} | ADM, GESTOR_FROTA | EditarMotorista | 200 RespostaMotorista | 400, 401, 403, 404, 409, 413, 415, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| DELETE | /api/motoristas/{id} | ADM, GESTOR_FROTA | sem corpo | 200 Exclusao | 401, 403, 404, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/abastecimentos | ADM, GESTOR_FROTA | sem corpo | 200 Abastecimentos | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| POST | /api/abastecimentos | ADM, GESTOR_FROTA | CriarAbastecimento | 201 RespostaAbastecimento | 400, 401, 403, 404, 413, 415, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/documentos | ADM, GESTOR_FROTA | sem corpo | 200 Documentos | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| GET | /api/documentos/pendencias | ADM, GESTOR_FROTA | sem corpo | 200 PendenciasDocumentos | 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |
| POST | /api/documentos | ADM, GESTOR_FROTA | CriarDocumento | 201 RespostaDocumento | 400, 413, 415, 401, 403, 500, 405 | legado | Formato atual preservado; query params não declarados são ignorados. |

Caminho desconhecido: 404 comum. Método não permitido: 405 + Allow, antes de auth. Todas as respostas recebem X-Request-Id. As exceções fechadas estão em [legacy-manifest.json](./legacy-manifest.json). Schemas legados documentam o transporte; não substituem os validadores existentes.
