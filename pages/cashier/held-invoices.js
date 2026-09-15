// الفواتير المعلّقة: list open held orders, resume one into the cart.

import { escapeHtml, timeStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchHeldOrders } from '../../shared/orders.js';
import { createPersistentOrder, loadPersistentOrder } from '../../shared/open-order.js';
import { state } from './state.js';
import { closeModal } from './modal.js';
import { confirmLeaveDirectCartIfNeeded, enterPersistentSession } from './cart.js';

export async function openHeldInvoices(){
  let held;
  try{ held = await fetchHeldOrders(); }catch(err){ console.error(err); toast('تعذّر تحميل الفواتير المعلّقة'); return; }

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>الفواتير المعلّقة (${held.length})</h3>
        ${held.map(o => `
          <div class="held-item" data-action="held:resume" data-id="${o.id}">
            <div class="top-row"><span>${escapeHtml(o.label || ('فاتورة #' + o.daily_number))}</span><span>${o.total} ج</span></div>
            <div class="meta">${escapeHtml(o.employee_name)} — <span class="en">${timeStr(new Date(o.created_at))}</span> — ${(o.order_items||[]).length} صنف</div>
          </div>
        `).join('') || '<div class="state-msg">مافي فواتير معلّقة دلوقتي</div>'}
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
}

async function resumeHeldOrder(orderId){
  if(!confirmLeaveDirectCartIfNeeded()) return;
  let loaded;
  try{ loaded = await loadPersistentOrder(orderId); }catch(err){ console.error(err); toast('تعذّر تحميل الفاتورة'); return; }
  const order = createPersistentOrder({ orderType: 'held', employee: state.currentEmployee });
  order.attachExisting(loaded.order, loaded.items);
  enterPersistentSession(order, 'فاتورة معلّقة: ' + (loaded.order.label || ('#' + loaded.order.daily_number)));
  closeModal();
}

export const heldInvoicesClickActions = {
  'held:openScreen': () => openHeldInvoices(),
  'held:resume': (el) => resumeHeldOrder(Number(el.dataset.id)),
};
