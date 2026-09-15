// تقرير اليوم: aggregation table, day picker, Excel export, Telegram send.

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml, todayStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchOrdersForDate, computeDayAggregation } from '../../shared/orders.js';
import { fetchExpensesForDate, expensesTotal } from '../../shared/expenses.js';
import { state } from './state.js';

// Fill this in after deploying the Edge Function (see EDGE_FUNCTION_SETUP.md)
const TELEGRAM_FUNCTION_URL = 'https://omyucnjkqeyomtvijqwc.supabase.co/functions/v1/send-telegram-report';

export async function openReport(dateStr){
  const selectedDate = dateStr || todayStr();
  let orders, expenses;
  try{
    [orders, expenses] = await Promise.all([fetchOrdersForDate(selectedDate), fetchExpensesForDate(selectedDate)]);
  }catch(err){ console.error(err); toast('تعذّر تحميل التقرير'); return; }

  const agg = computeDayAggregation(orders);
  const isAdmin = state.currentEmployee.is_admin;

  if(!isAdmin){
    const mine = agg.byEmployee[state.currentEmployee.name] || { count:0, cash:0, card:0, total:0 };
    document.getElementById('modalRoot').innerHTML = `
      <div class="modal-overlay">
        <div class="modal-box">
          <h3>تقريرك اليوم — <span class="en">${selectedDate}</span></h3>
          <table class="report-table">
            <tr><td>عدد الفواتير</td><td>${mine.count}</td></tr>
            <tr><td>كاش</td><td>${mine.cash} ج</td></tr>
            <tr><td>بنكك</td><td>${mine.card} ج</td></tr>
            <tr><td>الإجمالي</td><td>${mine.total} ج</td></tr>
          </table>
          <button class="close-btn" data-action="modal:close">قفل</button>
        </div>
      </div>`;
    return;
  }

  const rows = Object.entries(agg.byEmployee).map(([name, e]) => `
    <tr><td>${escapeHtml(name)}</td><td>${e.count}</td><td>${e.cash}</td><td>${e.card}</td><td>${e.total}</td></tr>
  `).join('') || `<tr><td colspan="5">مافي مبيعات في اليوم ده</td></tr>`;

  const expTotal = expensesTotal(expenses);
  const netProfit = agg.grandTotal - expTotal;

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>تقرير يوم <span class="en">${selectedDate}</span></h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
          <label style="font-size:12px; color:var(--cream-dim); flex-shrink:0;">اختار يوم تاني:</label>
          <input type="date" id="reportDatePicker" value="${selectedDate}" max="${todayStr()}" data-action="reports:pickDate"
            style="flex:1; background:var(--surface-2); border:1px solid var(--line); color:var(--cream); border-radius:8px; padding:8px 10px; font-size:13px;">
        </div>
        <table class="report-table">
          <thead><tr><th>الموظف</th><th>الفواتير</th><th>كاش</th><th>بنكك</th><th>الإجمالي</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td>الإجمالي الكلي</td><td>${agg.count}</td><td>${agg.grandCash}</td><td>${agg.grandCard}</td><td>${agg.grandTotal}</td></tr></tfoot>
        </table>
        <table class="report-table">
          <tr><td>صالة + ترابيزات + معلّقة</td><td>${(agg.byType.direct + agg.byType.table + agg.byType.held).toFixed(0)} ج</td></tr>
          <tr><td>تيك أواي</td><td>${agg.byType.takeaway.toFixed(0)} ج</td></tr>
          <tr><td>إجمالي المصروفات</td><td>${expTotal} ج</td></tr>
          <tr><td><b>صافي الربح</b></td><td><b>${netProfit} ج</b></td></tr>
        </table>
        <button class="secondary-btn" data-action="reports:downloadExcel" data-date="${selectedDate}">تحميل ملف إكسيل</button>
        <button class="confirm-btn" data-action="reports:sendTelegram" data-date="${selectedDate}" id="sendTgBtn">إرسال لتليجرام</button>
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
}

// ---- Build the Excel workbook: one sheet, each employee's items + qty, then grand total ----
async function buildReportWorkbook(dateStr){
  const [orders, expenses, { data: allItems, error: itemsErr }] = await Promise.all([
    fetchOrdersForDate(dateStr),
    fetchExpensesForDate(dateStr),
    sb.from('items').select('*').order('sort_order'),
  ]);
  const agg = computeDayAggregation(orders);
  const rows = [];
  rows.push(['تقرير مبيعات Farah Coffee', dateStr]);
  rows.push([]);

  const sourceItems = itemsErr ? state.menuItems : (allItems || []);
  const catOrder = state.categories.map(c => c.key);
  const sortedItems = catOrder.flatMap(cat => sourceItems.filter(it => it.category === cat));
  const itemNames = sortedItems.map(it => it.name_ar);

  const header = ['اسم الموظف', ...itemNames, 'كاش', 'بنكك', 'إجمالي الموظف'];
  rows.push(header);

  const employeeNames = Object.keys(agg.byEmployee);
  const itemColumnTotals = itemNames.map(() => 0);

  employeeNames.forEach(name => {
    const e = agg.byEmployee[name];
    const qtyCells = itemNames.map((itemName, i) => {
      const qty = e.items[itemName] || 0;
      itemColumnTotals[i] += qty;
      return qty;
    });
    rows.push([name, ...qtyCells, e.cash, e.card, e.total]);
  });

  rows.push(['الإجمالي', ...itemColumnTotals, agg.grandCash, agg.grandCard, agg.grandTotal]);
  rows.push([]);
  rows.push(['صالة + ترابيزات + معلّقة', agg.byType.direct + agg.byType.table + agg.byType.held]);
  rows.push(['تيك أواي', agg.byType.takeaway]);
  rows.push([]);

  const expTotal = expensesTotal(expenses);
  rows.push(['المصروفات']);
  rows.push(['اسم المصروف', 'المبلغ', 'الموظف اللي ضافه', 'ملحوظة']);
  expenses.forEach(e => {
    rows.push([e.name, e.amount, e.employee_name, e.note || '']);
  });
  rows.push(['إجمالي المصروفات', expTotal]);
  rows.push([]);

  rows.push(['صافي الربح', agg.grandTotal - expTotal]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  return wb;
}

async function downloadExcelReport(dateStr){
  const wb = await buildReportWorkbook(dateStr);
  XLSX.writeFile(wb, `farah-coffee-report-${dateStr}.xlsx`);
}

async function sendReportToTelegram(dateStr){
  const btn = document.getElementById('sendTgBtn');
  btn.disabled = true;
  btn.textContent = 'جاري الإرسال...';

  try{
    const wb = await buildReportWorkbook(dateStr);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    const res = await fetch(TELEGRAM_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: `farah-coffee-report-${dateStr}.xlsx`,
        fileBase64: wbout,
        caption: `تقرير مبيعات Farah Coffee - ${dateStr}`
      })
    });
    const json = await res.json();
    if(!res.ok || json.error){
      throw new Error(json.error || 'فشل الإرسال');
    }
    btn.textContent = '✓ اترسل لتليجرام';
  }catch(err){
    console.error(err);
    btn.textContent = 'حصل خطأ، جرب تاني';
    btn.disabled = false;
  }
}

export const reportsClickActions = {
  'reports:openScreen': () => openReport(),
  'reports:downloadExcel': (el) => downloadExcelReport(el.dataset.date),
  'reports:sendTelegram': (el) => sendReportToTelegram(el.dataset.date),
};

export const reportsChangeActions = {
  'reports:pickDate': (el) => openReport(el.value),
};
