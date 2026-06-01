-- Cria o banco usado pela Evolution API (WhatsApp)
-- Executado antes do init.sql (ordem alfabética no docker-entrypoint-initdb.d)
SELECT 'CREATE DATABASE evolution'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec
