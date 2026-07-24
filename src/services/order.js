import pool from '../config/database.js';

// ── Queries ────────────────────────────────────────────────

const findAll = async () => {
  const { rows } = await pool.query(
    'SELECT * FROM orders ORDER BY id ASC'
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

const create = async ({ customer_name, product_name, status }) => {
  const { rows } = await pool.query(
    `INSERT INTO orders (customer_name, product_name, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [customer_name, product_name, status || 'pending']
  );
  return rows[0];
};

const update = async (id, fields) => {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const key of ['customer_name', 'product_name', 'status']) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = $${paramIndex++}`);
      values.push(fields[key]);
    }
  }

  if (setClauses.length === 0) return findById(id);

  // Always bump updated_at on any change
  setClauses.push(`updated_at = NOW()`);

  values.push(id);
  const { rows } = await pool.query(
    `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return rows[0] || null;
};

const remove = async (id) => {
  const { rows } = await pool.query(
    'DELETE FROM orders WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
};

export default { findAll, findById, create, update, remove };

