// إدارة الموظفين (admin only): add / edit (name, PIN, admin flag) / delete.

import { escapeHtml, escapeAttr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { fetchEmployeesPublic, addEmployee, updateEmployee, deleteEmployee } from '../../shared/employees.js';
import { state } from './state.js';
import { openAdminPinPrompt } from './modal.js';

export function openManageEmployees(){
  if(!state.currentEmployee.is_admin) return;
  renderManageEmployeesModal();
}

function renderManageEmployeesModal(){
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>إدارة الموظفين</h3>
        <div id="empList"></div>
        <div class="add-emp-form">
          <input id="newEmpName" placeholder="اسم الموظف">
          <input id="newEmpPin" placeholder="PIN (أرقام)" inputmode="numeric" maxlength="6">
          <label><input type="checkbox" id="newEmpAdmin"> صلاحية أدمن</label>
          <input id="newEmpAdminPin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN الأدمن الحالي (للتأكيد)">
          <button class="confirm-btn" data-action="emp:add">إضافة موظف</button>
        </div>
        <button class="close-btn" data-action="modal:close">قفل</button>
      </div>
    </div>`;
  const listEl = document.getElementById('empList');
  listEl.innerHTML = state.employees.map(e => `
    <div class="emp-manage-row">
      <span>${e.is_admin ? '<span class="tag">أدمن</span>' : ''}${escapeHtml(e.name)}</span>
      <div style="display:flex; gap:6px;">
        <button class="del-btn" data-action="emp:editUI" data-id="${e.id}">تعديل</button>
        <button class="del-btn" data-action="emp:deletePrompt" data-id="${e.id}">حذف</button>
      </div>
    </div>
  `).join('');
}

async function addEmployeeUI(){
  const name = document.getElementById('newEmpName').value.trim();
  const pin = document.getElementById('newEmpPin').value.trim();
  const isAdmin = document.getElementById('newEmpAdmin').checked;
  const adminPin = document.getElementById('newEmpAdminPin').value.trim();
  if(!name || !pin){ alert('لازم اسم و PIN'); return; }
  if(!adminPin){ alert('لازم تدخل PIN الأدمن للتأكيد'); return; }

  try{
    await addEmployee({ adminPin, name, pin, isAdmin });
    state.employees = await fetchEmployeesPublic();
    renderManageEmployeesModal();
    toast('✓ اتضاف الموظف');
  }catch(err){
    alert(err.message || 'حصل خطأ في الإضافة');
  }
}

function editEmployeeUI(id){
  const emp = state.employees.find(e => e.id === id);
  if(!emp) return;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>تعديل بيانات الموظف</h3>
        <div class="add-emp-form">
          <input id="editEmpName" value="${escapeAttr(emp.name)}" placeholder="اسم الموظف">
          <input id="editEmpPin" placeholder="PIN جديد (سيبه فاضي لو مش هتغيّره)" inputmode="numeric" maxlength="6">
          <label><input type="checkbox" id="editEmpAdmin" ${emp.is_admin ? 'checked' : ''}> صلاحية أدمن</label>
          <input id="editEmpAdminPin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN الأدمن الحالي (للتأكيد)">
          <button class="confirm-btn" data-action="emp:submitEdit" data-id="${id}">حفظ التعديلات</button>
        </div>
        <div class="modal-error" id="editEmpError">PIN غلط — لازم PIN أدمن</div>
        <button class="close-btn" data-action="emp:backToList">رجوع</button>
      </div>
    </div>`;
}

async function submitEditEmployee(id){
  const name = document.getElementById('editEmpName').value.trim();
  const pin = document.getElementById('editEmpPin').value.trim();
  const isAdmin = document.getElementById('editEmpAdmin').checked;
  const adminPin = document.getElementById('editEmpAdminPin').value.trim();
  const errEl = document.getElementById('editEmpError');
  errEl.classList.remove('show');

  if(!name){ errEl.textContent = 'لازم اسم الموظف'; errEl.classList.add('show'); return; }
  if(!adminPin){ errEl.textContent = 'لازم تدخل PIN الأدمن للتأكيد'; errEl.classList.add('show'); return; }

  try{
    await updateEmployee({ adminPin, id, name, pin: pin || undefined, isAdmin });
    state.employees = await fetchEmployeesPublic();
    renderManageEmployeesModal();
    toast('✓ اتحفظت بيانات الموظف');
  }catch(err){
    errEl.textContent = err.message || 'حصل خطأ في الحفظ';
    errEl.classList.add('show');
  }
}

function deleteEmployeePrompt(id){
  openAdminPinPrompt('تأكيد حذف الموظف', async () => {
    try{
      await deleteEmployee({ adminPin: document.getElementById('adminPinInput').value.trim(), id });
      state.employees = await fetchEmployeesPublic();
      renderManageEmployeesModal();
      toast('✓ اتحذف الموظف');
    }catch(err){
      toast(err.message || 'حصل خطأ في الحذف');
    }
  });
}

export const employeesClickActions = {
  'emp:openScreen': () => openManageEmployees(),
  'emp:add': () => addEmployeeUI(),
  'emp:editUI': (el) => editEmployeeUI(Number(el.dataset.id)),
  'emp:submitEdit': (el) => submitEditEmployee(Number(el.dataset.id)),
  'emp:deletePrompt': (el) => deleteEmployeePrompt(Number(el.dataset.id)),
  'emp:backToList': () => renderManageEmployeesModal(),
};
