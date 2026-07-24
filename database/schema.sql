-- ============================================================
-- Schema: orders table
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100)  NOT NULL,
  product_name  VARCHAR(150)  NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'shipped', 'delivered')),
  updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Sample data for development / testing
-- ============================================================

INSERT INTO orders (customer_name, product_name, status) VALUES
  ('Alice Johnson',  'Mechanical Keyboard',   'pending'),
  ('Bob Smith',      'Wireless Mouse',        'shipped'),
  ('Charlie Lee',    '27" 4K Monitor',        'delivered'),
  ('Diana Patel',    'USB-C Hub',             'pending'),
  ('Ethan Brown',    'Noise-Cancelling Headphones', 'shipped');
