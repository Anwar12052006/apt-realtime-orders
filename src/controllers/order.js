import orderService from '../services/order.js';

const VALID_STATUSES = ['pending', 'shipped', 'delivered'];

// ── Helpers ────────────────────────────────────────────────

const validateBody = (body, isPartial = false) => {
  const errors = [];

  if (!isPartial || body.customer_name !== undefined) {
    if (!body.customer_name?.trim()) errors.push('customer_name is required');
  }

  if (!isPartial || body.product_name !== undefined) {
    if (!body.product_name?.trim()) errors.push('product_name is required');
  }

  if (!isPartial || body.status !== undefined) {
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }

  return errors;
};

// ── Controllers ────────────────────────────────────────────

export const getAllOrders = async (_req, res, next) => {
  try {
    const orders = await orderService.findAll();
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid order ID' });

    const order = await orderService.findById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const errors = validateBody(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const order = await orderService.create(req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid order ID' });

    const errors = validateBody(req.body, true);
    if (errors.length) return res.status(400).json({ errors });

    const order = await orderService.update(id, req.body);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid order ID' });

    const order = await orderService.remove(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted', order });
  } catch (err) {
    next(err);
  }
};
