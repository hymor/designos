-- Initial database setup for DesignOS
-- This script is executed automatically by the postgres image on first startup.

-- Ensure the database exists (it is also created by POSTGRES_DB, but this is idempotent).
DO
$$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'mydb'
  ) THEN
    PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE mydb');
  END IF;
END
$$ LANGUAGE plpgsql;

