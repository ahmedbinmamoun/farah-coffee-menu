// المصروفات: today's expenses list, add (anyone), delete (admin-PIN gated).

import { escapeHtml, todayStr, timeStr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchExpensesForDate, addExpense, deleteExpense, expensesTotal } from '../../shared/expenses.js';
import { state } from './state.js';
import { openAdminPinPrompt } from './modal.js';

export async function openExpenses(){
  let expenses;
  try{ expenses = await fetchExpensesForDate(todayStr()); }catch(err){ console.error(err); toast('تعذّر تحميل المصروفات'); return; }
  const total = expensesTotal(expenses);

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>مصروفات اليوم — إجمالي ${total} ج</h3>
        <div id="expList">
          ${expenses.map(e => `
            <div class="expense-row">
              <div class="info">
                <span>${escapeHtml(e.name)}</span>
                <span class="meta">${escapeHtml(e.employee_name)} — <span class="en">${timeStr(new Date(e.created_at))}</span>${e.note ? ' — ' + escapeHtml(e.note) : ''}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="amt">${e.amount} ج</span>
                <button class="del-btn" data-action="expenses:deletePrompt" data-id="${e.id}">حذف</button>
              </div>
            </div>
          `).join('') || '<div class="state-msg">مفيش مصروفات اليوم لسه</div>'}
        </div>
        <div class="add-expense-form">
          <input id="newExpName" placeholder="اسم المصروف (مثال: سكر وحليب)">
          <input id="newExpAmount" type="number" placeholder="المبلغ">
          <input id="newExpNote" placeholder="ملحوظة (اختياري)">
          <button class="confirm-btn" data-action="expenses:add">إضافة مصروف</button>
        </div>
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
}

async function addExpenseUI(){
  const name = document.getElementById('newExpName').value.trim();
  const amount = Number(document.getElementById('newExpAmount').value);
  const note = document.getElementById('newExpNote').value.trim();

  if(!name || !amount || amount <= 0){
    alert('لازم اسم المصروف والمبلغ');
    return;
  }

  try{
    await addExpense({ employee: state.currentEmployee, name, amount, note });
    openExpenses();
  }catch(err){
    console.error(err);
    toast('حصل خطأ في إضافة المصروف');
  }
}

function deleteExpensePrompt(id){
  openAdminPinPrompt('تأكيد حذف المصروف', async () => {
    try{
      await deleteExpense(id);
      toast('✓ اتحذف المصروف');
      openExpenses();
    }catch(err){
      console.error(err);
      toast('حصل خطأ في الحذف');
    }
  });
}

export const expensesClickActions = {
  'expenses:openScreen': () => openExpenses(),
  'expenses:add': () => addExpenseUI(),
  'expenses:deletePrompt': (el) => deleteExpensePrompt(Number(el.dataset.id)),
};
