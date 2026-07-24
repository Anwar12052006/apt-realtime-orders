-- ============================================================
-- Trigger function: notify on any orders table change
-- ============================================================

CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  row_data JSON;
BEGIN
  -- For DELETE, NEW is NULL — use OLD
  -- For INSERT / UPDATE, use NEW
  IF TG_OP = 'DELETE' THEN
    row_data := row_to_json(OLD);
  ELSE
    row_data := row_to_json(NEW);
  END IF;

  payload := json_build_object(
    'operation', TG_OP,
    'data', row_data
  );

  PERFORM pg_notify('order_changes', payload::TEXT);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: fire AFTER every INSERT, UPDATE, DELETE on orders
-- ============================================================

DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

CREATE TRIGGER orders_change_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_change();
