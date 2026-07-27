-- ============================================================
-- DEPRECATED: PostgreSQL Triggers and LISTEN/NOTIFY
-- ============================================================
-- This file is retained for reference/migration purposes only.
-- The application has migrated to PostgreSQL WAL + Debezium CDC.
-- PostgreSQL triggers and pg_notify are no longer used.
-- ============================================================

-- Drop legacy trigger and function if present
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;
DROP FUNCTION IF EXISTS notify_order_change();
