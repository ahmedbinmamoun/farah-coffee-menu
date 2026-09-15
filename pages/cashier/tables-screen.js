// الترابيزات: grid of active tables, live occupied/empty state.

import { escapeHtml } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchActiveTables, subscribeTables } from '../../shared/tables.js';
import { fetchOpenTableOrders, subscribeOrders } from '../../shared/orders.js';
import { createPersistentOrder } from '../../shared/open-order.js';
import { state } from './state.js';
import { closeModal, trackModalChannel } from './modal.js';
import { confirmLeaveDirectCartIfNeeded, enterPersistentSession } from './cart.js';

export async function openTablesScreen(){
  try{
    await renderTablesScreen();
  }catch(err){ console.error(err); toast('تعذّر تحميل الترابيزات'); return; }

  // Live-refresh the grid while it's open: admin adding/removing a table, or
  // another device opening/closing a table order, should reflect immediately.
  trackModalChannel(subscribeTables(() => renderTablesScreen()));
  trackModalChannel(subscribeOrders(() => renderTablesScreen()));
}

async function renderTablesScreen(){
  const [tables, openOrders] = await Promise.all([fetchActiveTables(), fetchOpenTableOrders()]);
  state.tablesCache = tables;

  const byTable = {};
  openOrders.forEach(o => { byTable[o.table_id] = o; });

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>الترابيزات</h3>
        <div class="tables-grid">
          ${tables.map(t => {
            const o = byTable[t.id];
            return `
            <button class="table-card ${o ? 'occupied' : ''}" data-action="tables:open" data-id="${t.id}">
              <span class="lbl">ترابيزة ${escapeHtml(t.label)}</span>
              ${o ? `<span class="info">${(o.order_items||[]).length} صنف — ${o.total} ج</span>` : `<span class="info">فاضية</span>`}
            </button>`;
          }).join('') || '<div class="state-msg">مفيش ترابيزات مفعّلة — كلّم الأدمن</div>'}
        </div>
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
}

async function openTable(tableId){
  if(!confirmLeaveDirectCartIfNeeded()) return;
  let openOrders;
  try{ openOrders = await fetchOpenTableOrders(); }catch(err){ console.error(err); toast('تعذّر فتح الترابيزة'); return; }
  const existing = openOrders.find(o => o.table_id === tableId);
  const order = createPersistentOrder({ orderType: 'table', tableId, employee: state.currentEmployee });
  if(existing){
    order.attachExisting(existing, existing.order_items || []);
  }
  const table = state.tablesCache.find(t => t.id === tableId);
  enterPersistentSession(order, 'ترابيزة ' + (table ? table.label : tableId));
  closeModal();
}

export const tablesScreenClickActions = {
  'tables:openScreen': () => openTablesScreen(),
  'tables:open': (el) => openTable(Number(el.dataset.id)),
};
