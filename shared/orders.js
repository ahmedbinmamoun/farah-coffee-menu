// Orders / order_items data access — replaces the old localStorage
// getInvoices/saveInvoices in cashier.html with a single Supabase source of
// truth shared across every cashier device.

import { sb } from './supabase-client.js';

export async function nextDailyNumber(dateStr) {
  const { data, error } = await sb.rpc('next_daily_order_number', dateStr ? { p_date: dateStr } : {});
  if (error) throw error;
  return data;
}

// A "direct" sale is created and completed in one shot at checkout — it never
// exists as an "open" row, matching the current one-step cashier flow.
export async function createDirectOrder({ cartItems, employee, paymentMethod }) {
  const daily_number = await nextDailyNumber();
  const total = cartItems.reduce((s, c) => s + c.price * c.qty, 0);

  const { data: order, error } = await sb
    .from('orders')
    .insert({
      daily_number,
      order_type: 'direct',
      status: 'completed',
      employee_id: employee.id,
      employee_name: employee.name,
      closed_by_employee_id: employee.id,
      closed_by_employee_name: employee.name,
      payment_method: paymentMethod,
      total,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  if (cartItems.length) {
    const { error: itemsErr } = await sb.from('order_items').insert(
      cartItems.map((c) => ({
        order_id: order.id, item_id: c.item_id ?? null, name_ar: c.name_ar, price: c.price, qty: c.qty,
      })),
    );
    if (itemsErr) throw itemsErr;
  }

  return order;
}

export async function fetchOrdersForDate(dateStr) {
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_date', dateStr)
    .order('daily_number', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchHeldOrders() {
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_type', 'held')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchOpenTableOrders() {
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_type', 'table')
    .eq('status', 'open');
  if (error) throw error;
  return data || [];
}

export async function voidOrder(orderId) {
  const { error } = await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (error) throw error;
}

// Only status='completed' orders count as real sales (a still-open held/table/
// takeaway order hasn't been paid for yet, and 'cancelled' ones were voided).
export function computeDayAggregation(orders) {
  const completed = orders.filter((o) => o.status === 'completed');
  const byEmployee = {};
  const byType = { direct: 0, table: 0, held: 0, takeaway: 0 };
  let grandTotal = 0, grandCash = 0, grandCard = 0;

  completed.forEach((o) => {
    const name = o.closed_by_employee_name || o.employee_name;
    if (!byEmployee[name]) byEmployee[name] = { count: 0, cash: 0, card: 0, total: 0, items: {} };
    const e = byEmployee[name];
    const total = Number(o.total);
    e.count++;
    e.total += total;
    if (o.payment_method === 'cash') { e.cash += total; grandCash += total; }
    else { e.card += total; grandCard += total; }
    grandTotal += total;
    byType[o.order_type] = (byType[o.order_type] || 0) + total;
    (o.order_items || []).forEach((it) => {
      e.items[it.name_ar] = (e.items[it.name_ar] || 0) + it.qty;
    });
  });

  return { byEmployee, grandTotal, grandCash, grandCard, byType, count: completed.length };
}

export function subscribeOrders(onChange) {
  return sb
    .channel('public:orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, onChange)
    .subscribe();
}
