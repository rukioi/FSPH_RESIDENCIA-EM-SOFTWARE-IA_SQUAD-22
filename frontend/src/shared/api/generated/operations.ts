/* Gerado por client:generate. Não editar. */
export const apiOperations = {
  "auth_post__api_auth_login": {
    "method": "POST",
    "path": "/api/auth/login"
  },
  "auth_get__api_auth_sessao": {
    "method": "GET",
    "path": "/api/auth/sessao"
  },
  "usuarios_get__api_admin_usuarios": {
    "method": "GET",
    "path": "/api/admin/usuarios"
  },
  "usuarios_post__api_admin_usuarios": {
    "method": "POST",
    "path": "/api/admin/usuarios"
  },
  "usuarios_put__api_admin_usuarios_id_": {
    "method": "PUT",
    "path": "/api/admin/usuarios/{id}"
  },
  "usuarios_patch__api_admin_usuarios_id_status": {
    "method": "PATCH",
    "path": "/api/admin/usuarios/{id}/status"
  },
  "auditoria_get__api_admin_auditoria_logs": {
    "method": "GET",
    "path": "/api/admin/auditoria/logs"
  },
  "dashboard_get__api_dashboard": {
    "method": "GET",
    "path": "/api/dashboard"
  },
  "dashboard_get__api_dashboard_graficos": {
    "method": "GET",
    "path": "/api/dashboard/graficos"
  },
  "dashboard_get__api_dashboard_pendencias": {
    "method": "GET",
    "path": "/api/dashboard/pendencias"
  },
  "dashboard_get__api_dashboard_gestor": {
    "method": "GET",
    "path": "/api/dashboard/gestor"
  },
  "svo_get__api_svo_ordens_coleta": {
    "method": "GET",
    "path": "/api/svo/ordens-coleta"
  },
  "svo_post__api_svo_solicitacoes": {
    "method": "POST",
    "path": "/api/svo/solicitacoes"
  },
  "svo_patch__api_svo_ordens_coleta_id_despachar": {
    "method": "PATCH",
    "path": "/api/svo/ordens-coleta/{id}/despachar"
  },
  "veiculos_get__api_veiculos": {
    "method": "GET",
    "path": "/api/veiculos"
  },
  "veiculos_post__api_veiculos": {
    "method": "POST",
    "path": "/api/veiculos"
  },
  "veiculos_put__api_veiculos_id_": {
    "method": "PUT",
    "path": "/api/veiculos/{id}"
  },
  "veiculos_patch__api_veiculos_id_": {
    "method": "PATCH",
    "path": "/api/veiculos/{id}"
  },
  "veiculos_delete__api_veiculos_id_": {
    "method": "DELETE",
    "path": "/api/veiculos/{id}"
  },
  "motoristas_get__api_motoristas": {
    "method": "GET",
    "path": "/api/motoristas"
  },
  "motoristas_post__api_motoristas": {
    "method": "POST",
    "path": "/api/motoristas"
  },
  "motoristas_put__api_motoristas_id_": {
    "method": "PUT",
    "path": "/api/motoristas/{id}"
  },
  "motoristas_patch__api_motoristas_id_": {
    "method": "PATCH",
    "path": "/api/motoristas/{id}"
  },
  "motoristas_delete__api_motoristas_id_": {
    "method": "DELETE",
    "path": "/api/motoristas/{id}"
  },
  "abastecimentos_get__api_abastecimentos": {
    "method": "GET",
    "path": "/api/abastecimentos"
  },
  "abastecimentos_post__api_abastecimentos": {
    "method": "POST",
    "path": "/api/abastecimentos"
  },
  "documentos_get__api_documentos": {
    "method": "GET",
    "path": "/api/documentos"
  },
  "documentos_post__api_documentos": {
    "method": "POST",
    "path": "/api/documentos"
  },
  "documentos_get__api_documentos_pendencias": {
    "method": "GET",
    "path": "/api/documentos/pendencias"
  }
} as const;
