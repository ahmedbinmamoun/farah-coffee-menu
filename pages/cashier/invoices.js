// فواتير الليلة: completed/cancelled orders for today, with admin-PIN void.

import { escapeHtml, todayStr, timeStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchOrdersForDate, voidOrder } from '../../shared/orders.js';
import { state } from './state.js';
import { openAdminPinPrompt } from './modal.js';

function orderTypeLabel(t){
  return { direct: 'صالة', table: 'ترابيزة', held: 'معلّقة', takeaway: 'تيك أواي' }[t] || t;
}

export async function openInvoices(){
  let orders;
  try{ orders = await fetchOrdersForDate(todayStr()); }catch(err){ console.error(err); toast('تعذّر تحميل الفواتير'); return; }

  const isAdmin = state.currentEmployee.is_admin;
  if(!isAdmin) orders = orders.filter(o => o.employee_id === state.currentEmployee.id || o.closed_by_employee_id === state.currentEmployee.id);
  orders = orders.filter(o => o.status !== 'open'); // "فواتير الليلة" = completed/cancelled sales, not still-open carts

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>فواتير الليلة (${orders.length})</h3>
        ${orders.map(o => `
          <div class="invoice-item ${o.status === 'cancelled' ? 'cancelled' : ''}">
            <div class="top-row"><span>فاتورة #${o.daily_number} <span style="font-size:10px;color:var(--cream-dim);">${orderTypeLabel(o.order_type)}</span></span><span>${o.total} ج</span></div>
            <div class="meta">${escapeHtml(o.closed_by_employee_name || o.employee_name)} — <span class="en">${timeStr(new Date(o.completed_at || o.created_at))}</span> — ${o.payment_method==='cash'?'كاش':'بنكك'}${o.status==='cancelled' ? ' — ملغاة' : ''}</div>
            ${o.status !== 'cancelled' ? `<button class="void-btn" data-action="invoices:voidPrompt" data-id="${o.id}">إلغاء الفاتورة</button>` : ''}
          </div>
        `).join('') || '<div class="state-msg">مافي فواتير الليلة لسه</div>'}
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
}

function voidInvoicePrompt(orderId){
  openAdminPinPrompt('تأكيد إلغاء الفاتورة', async () => {
    try{
      await voidOrder(orderId);
      toast('✓ اتلغت الفاتورة');
      openInvoices();
    }catch(err){
      console.error(err);
      toast('حصل خطأ في الإلغاء');
    }
  });
}

export const invoicesClickActions = {
  'invoices:openScreen': () => openInvoices(),
  'invoices:voidPrompt': (el) => voidInvoicePrompt(Number(el.dataset.id)),
};
