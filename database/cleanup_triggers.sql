-- ============================================================
-- Migration Cleanup: Safely remove legacy LISTEN/NOTIFY trigger
-- ============================================================

-- Safely drop legacy trigger if it exists
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

-- Safely drop legacy trigger function if it exists
DROP FUNCTION IF EXISTS notify_order_change();
