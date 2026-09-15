// Boots the cashier page: wires auth callbacks, merges every feature
// module's data-action registry into one delegated click/change listener,
// and starts realtime subscriptions once an employee is actually logged in.

import { sb } from '../../shared/supabase-client.js';
import { delegate } from '../../shared/dom.js';
import { subscribeCategories } from '../../shared/categories.js';
import { createPersistentOrder } from '../../shared/open-order.js';
import { state } from './state.js';
import { loadEmployees, doLogin, setOnEnterApp, authClickActions } from './auth.js';
import { modalActions } from './modal.js';
import { refreshCategories, loadMenu, renderCats, menuClickActions } from './menu.js';
import { cartClickActions, confirmLeaveDirectCartIfNeeded, enterPersistentSession } from './cart.js';
import { checkoutClickActions } from './checkout.js';
import { tablesScreenClickActions } from './tables-screen.js';
import { heldInvoicesClickActions } from './held-invoices.js';
import { invoicesClickActions } from './invoices.js';
import { expensesClickActions } from './expenses-ui.js';
import { reportsClickActions, reportsChangeActions } from './reports.js';
import { employeesClickActions } from './employees-mgmt.js';

// ---- Take Away (small enough to keep inline; just wires cart.js + open-order.js) ----
function startTakeaway(){
  if(!confirmLeaveDirectCartIfNeeded()) return;
  const order = createPersistentOrder({ orderType: 'takeaway', employee: state.currentEmployee });
  enterPersistentSession(order, 'تيك أواي — طلب جديد');
}

delegate(document, 'click', {
  ...authClickActions,
  ...modalActions,
  ...menuClickActions,
  ...cartClickActions,
  ...checkoutClickActions,
  ...tablesScreenClickActions,
  ...heldInvoicesClickActions,
  ...invoicesClickActions,
  ...expensesClickActions,
  ...reportsClickActions,
  ...employeesClickActions,
  'takeaway:start': () => startTakeaway(),
});

delegate(document, 'change', {
  ...reportsChangeActions,
});

let realtimeSetup = false;
async function enterApp(){
  await refreshCategories();
  await loadMenu();

  if(realtimeSetup) return;
  realtimeSetup = true;
  subscribeCategories(async () => { await refreshCategories(); renderCats(); });
  sb.channel('public:items:cashier')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => loadMenu())
    .subscribe();
}

setOnEnterApp(enterApp);

loadEmployees();

document.getElementById('pinInput').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') doLogin();
});
