// The unified "Open Order" concept (PRD §4.7): one shared cart engine used by
// the table mini-cashier, resumed held invoices, and the takeaway cart.
// The only differences between the three are `order_type` and (optionally)
// `table_id` / `label` — everything else (cart math, persistence, checkout)
// is identical, which is exactly what this module centralizes.
//
// A "direct" walk-up sale does NOT use this module: it stays a purely local
// cart that's written to Supabase in one shot at checkout (see shared/orders.js
// createDirectOrder), same as the app's current behavior.

import { sb } from './supabase-client.js';
import { nextDailyNumber } from './orders.js';

export function createPersistentOrder({ orderType, tableId = null, label = null, employee }) {
  let orderId = null;
  let dailyNumber = null;
  let items = []; // { item_id, name_ar, price, qty }

  function total() {
    return items.reduce((s, i) => s + i.price * i.qty, 0);
  }
  function itemCount() {
    return items.reduce((s, i) => s + i.qty, 0);
  }
  function getItems() {
    return items.map((i) => ({ ...i }));
  }
  function setItems(list) {
    items = (list || []).map((i) => ({ ...i }));
  }
  function attachExisting(order, orderItems) {
    orderId = order.id;
    dailyNumber = order.daily_number;
    items = (orderItems || []).map((i) => ({ item_id: i.item_id, name_ar: i.name_ar, price: i.price, qty: i.qty }));
  }

  // Writes the current cart state to Supabase — creates the order row the
  // first time (first item added), updates it every time after that. This is
  // what makes an open table/held/takeaway order visible, live, to every
  // other cashier device via realtime.
  async function persist() {
    if (!orderId) {
      dailyNumber = await nextDailyNumber();
      const { data, error } = await sb
        .from('orders')
        .insert({
          daily_number: dailyNumber,
          order_type: orderType,
          table_id: tableId,
          label,
          status: 'open',
          employee_id: employee.id,
          employee_name: employee.name,
          total: total(),
        })
        .select()
        .single();
      if (error) throw error;
      orderId = data.id;
    } else {
      const { error } = await sb.from('orders').update({ total: total() }).eq('id', orderId);
      if (error) throw error;
    }

    const { error: delErr } = await sb.from('order_items').delete().eq('order_id', orderId);
    if (delErr) throw delErr;

    if (items.length) {
      const { error: insErr } = await sb.from('order_items').insert(
        items.map((it) => ({ order_id: orderId, item_id: it.item_id, name_ar: it.name_ar, price: it.price, qty: it.qty })),
      );
      if (insErr) throw insErr;
    }
  }

  async function changeQty(menuItem, delta) {
    let row = items.find((i) => i.item_id === menuItem.id);
    if (!row && delta > 0) {
      items.push({ item_id: menuItem.id, name_ar: menuItem.name_ar, price: menuItem.price, qty: 1 });
    } else if (row) {
      row.qty += delta;
      if (row.qty <= 0) items = items.filter((i) => i !== row);
    }
    await persist();
  }

  // Used when converting an in-progress direct cart into a held invoice: the
  // whole cart is known up front, so we create the order + all items in one call.
  async function createFromCart(cartItems) {
    setItems(cartItems);
    await persist();
  }

  async function complete(paymentMethod, closedByEmployee) {
    if (!orderId) throw new Error('لا يوجد طلب لإتمامه');
    const { error } = await sb
      .from('orders')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
        total: total(),
        closed_by_employee_id: closedByEmployee.id,
        closed_by_employee_name: closedByEmployee.name,
        completed_at: new Date().toISOString(),
      })
      .eq('id', orderId);
    if (error) throw error;
    return { orderId, dailyNumber, total: total() };
  }

  async function cancel() {
    if (!orderId) return;
    const { error } = await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (error) throw error;
  }

  return {
    get id() { return orderId; },
    get dailyNumber() { return dailyNumber; },
    total,
    itemCount,
    getItems,
    setItems,
    attachExisting,
    changeQty,
    persist,
    createFromCart,
    complete,
    cancel,
  };
}

export async function loadPersistentOrder(orderId) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
  if (error) throw error;
  const { data: orderItems, error: itemsErr } = await sb.from('order_items').select('*').eq('order_id', orderId);
  if (itemsErr) throw itemsErr;
  return { order, items: orderItems || [] };
}
