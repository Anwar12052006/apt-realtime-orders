-- ============================================================
-- Schema: orders table (Debezium WAL CDC Compatible)
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100)  NOT NULL,
  product_name  VARCHAR(150)  NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'shipped', 'delivered')),
  updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Configure table replica identity to FULL so WAL records for UPDATE and DELETE
-- contain full row snapshots required for Debezium CDC payload contract.
ALTER TABLE orders REPLICA IDENTITY FULL;

-- ============================================================
-- Sample data for development / testing (Idempotent)
-- ============================================================

INSERT INTO orders (id, customer_name, product_name, status) VALUES
  (1, 'Alice Johnson',  'Mechanical Keyboard',   'pending'),
  (2, 'Bob Smith',      'Wireless Mouse',        'shipped'),
  (3, 'Charlie Lee',    '27" 4K Monitor',        'delivered'),
  (4, 'Diana Patel',    'USB-C Hub',             'pending'),
  (5, 'Ethan Brown',    'Noise-Cancelling Headphones', 'shipped')
ON CONFLICT (id) DO NOTHING;

-- Synchronize sequence value after explicit ID inserts
SELECT setval('orders_id_seq', GREATEST((SELECT MAX(id) FROM orders), 1));
