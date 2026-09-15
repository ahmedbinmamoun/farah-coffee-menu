// إدارة الترابيزات: add / rename / activate-deactivate / delete tables.

import { escapeHtml, escapeAttr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchAllTables, addTable, setTableActive, renameTable, deleteTable } from '../../shared/tables.js';
import { state } from './state.js';
import { closeModal } from './modal.js';

export async function loadTablesMgmt(){
  try{
    state.tables = await fetchAllTables();
  }catch(err){
    console.error(err);
    document.getElementById('tablesMgmt').innerHTML = '<div class="state-msg">تعذّر تحميل الترابيزات</div>';
    return;
  }
  renderTablesMgmt();
}

function renderTablesMgmt(){
  const el = document.getElementById('tablesMgmt');
  el.innerHTML = `
    ${state.tables.map(t => `
      <div class="mgmt-row">
        <div class="mgmt-names">
          <span>ترابيزة ${escapeHtml(t.label)}</span>
          <span class="status-tag ${t.active ? 'on' : ''}">${t.active ? 'فعّالة' : 'متوقفة'}</span>
        </div>
        <div class="mgmt-controls">
          <button class="delete-btn" title="${t.active ? 'تعطيل' : 'تفعيل'}" data-action="table:toggleActive" data-id="${t.id}" data-active="${!t.active}">${t.active ? '⏸' : '▶'}</button>
          <button class="delete-btn" title="تعديل الاسم" data-action="table:editUI" data-id="${t.id}">✎</button>
          <button class="delete-btn" title="حذف الترابيزة نهائيًا" data-action="table:delete" data-id="${t.id}">✕</button>
        </div>
      </div>`).join('') || '<div class="state-msg">مفيش ترابيزات لسه</div>'}
    <div class="mgmt-add-form">
      <input id="newTableLabel" placeholder="رقم/اسم الترابيزة (مثال: 5)">
      <button data-action="table:add">+ إضافة ترابيزة</button>
    </div>`;
}

async function addTableUI(){
  const input = document.getElementById('newTableLabel');
  const label = input.value.trim();
  if(!label){ alert('لازم تكتب رقم أو اسم الترابيزة'); return; }
  const nextSort = state.tables.length ? Math.max(...state.tables.map(t => t.sort_order || 0)) + 1 : 1;
  try{
    await addTable({ label, sortOrder: nextSort });
    input.value = '';
    toast('✓ اتضافت الترابيزة');
    await loadTablesMgmt();
  }catch(err){
    console.error(err);
    toast('حصل خطأ في الإضافة');
  }
}

async function toggleTableActiveUI(id, active){
  try{
    await setTableActive(id, active);
    toast(active ? '✓ الترابيزة بقت فعّالة' : '✓ الترابيزة اتوقفت');
    await loadTablesMgmt();
  }catch(err){
    console.error(err);
    toast('حصل خطأ في الحفظ');
  }
}

function editTableUI(id){
  const t = state.tables.find(t => t.id === id);
  if(!t) return;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>تعديل اسم الترابيزة</h3>
        <div class="pass-form">
          <input id="editTableLabel" value="${escapeAttr(t.label)}" placeholder="رقم/اسم الترابيزة">
          <button data-action="table:submitEdit" data-id="${id}">حفظ</button>
        </div>
        <div class="modal-error" id="editTableError"></div>
        <button class="close-btn" data-action="modal:close">إلغاء</button>
      </div>
    </div>`;
}

async function submitEditTable(id){
  const label = document.getElementById('editTableLabel').value.trim();
  const errEl = document.getElementById('editTableError');
  errEl.classList.remove('show');

  if(!label){
    errEl.textContent = 'لازم تكتب اسم الترابيزة';
    errEl.classList.add('show');
    return;
  }

  try{
    await renameTable(id, label);
    closeModal();
    toast('✓ اتحفظ اسم الترابيزة');
    await loadTablesMgmt();
  }catch(err){
    errEl.textContent = 'حصل خطأ: ' + err.message;
    errEl.classList.add('show');
  }
}

async function deleteTableUI(id){
  if(!confirm('متأكد إنك عايز تحذف الترابيزة دي نهائيًا؟')) return;
  try{
    await deleteTable(id);
    toast('✓ اتحذفت الترابيزة');
    await loadTablesMgmt();
  }catch(err){
    console.error(err);
    toast('الترابيزة دي مرتبطة بطلبات سابقة — عطّلها (⏸) بدل الحذف');
  }
}

export const tablesClickActions = {
  'table:add': () => addTableUI(),
  'table:toggleActive': (el) => toggleTableActiveUI(Number(el.dataset.id), el.dataset.active === 'true'),
  'table:editUI': (el) => editTableUI(Number(el.dataset.id)),
  'table:submitEdit': (el) => submitEditTable(Number(el.dataset.id)),
  'table:delete': (el) => deleteTableUI(Number(el.dataset.id)),
};
