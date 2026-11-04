-- Exclusivamente para o volume PostgreSQL local fsph_compose_dev_db_data_2026.
-- Estas credenciais são fixtures públicas; nunca usar em produção.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE supabase_admin NOLOGIN;
CREATE ROLE fsph_compose_app LOGIN PASSWORD 'fsph-compose-local-app-2026';
GRANT service_role TO fsph_compose_app;
COMMENT ON DATABASE fsph_compose_dev IS 'fsph-compose-local-dev-2026-v1';
