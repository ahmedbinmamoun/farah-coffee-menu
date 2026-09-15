// Mutable state shared across the cashier page's feature modules.
// Plain object + direct mutation (no framework) — every module imports the
// same `state` reference, so a change made in one module is immediately
// visible to the others without any event bus.

export const state = {
  categories: [],
  employees: [],          // pos_employees_public rows: { id, name, is_admin } — no pin, ever
  menuItems: [],
  currentCat: null,
  cart: [],                // direct-mode local cart: { item_id, name_ar, price, qty }
  currentEmployee: null,   // { id, name, is_admin }
  selectedEmpId: null,
  tablesCache: [],
  pendingPayment: null,

  // Unified "open order" session (PRD §4.7).
  // mode 'direct'     -> uses `state.cart`, nothing persisted until checkout/hold
  // mode 'persistent' -> uses `session.order` (shared/open-order.js), synced to Supabase on every change
  session: { mode: 'direct', order: null, contextLabel: '' },
};
