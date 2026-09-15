// Employee login/logout (PIN-based, verified server-side — see shared/employees.js).
// What happens right after a successful login (load menu/categories, start
// realtime) is owned by main.js and injected here via setOnEnterApp, so this
// module only knows about the login screen itself.

import { fetchEmployeesPublic, loginEmployee } from '../../shared/employees.js';
import { state } from './state.js';

const empGrid = document.getElementById('empGrid');

let onEnterApp = () => {};
export function setOnEnterApp(fn){ onEnterApp = fn; }

export async function loadEmployees(){
  try{
    state.employees = await fetchEmployeesPublic();
  }catch(error){
    empGrid.innerHTML = '<div class="state-msg">تعذّر تحميل قائمة الموظفين</div>';
    console.error(error);
    return;
  }
  empGrid.innerHTML = '';
  state.employees.forEach(emp => {
    const btn = document.createElement('button');
    btn.className = 'emp-btn';
    btn.textContent = emp.name + (emp.is_admin ? ' (أدمن)' : '');
    btn.addEventListener('click', () => {
      state.selectedEmpId = emp.id;
      document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    empGrid.appendChild(btn);
  });
}

export async function doLogin(){
  const pin = document.getElementById('pinInput').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');

  if(!state.selectedEmpId || !pin){
    errEl.textContent = 'اختار اسمك واكتب الـ PIN';
    errEl.classList.add('show');
    return;
  }

  let emp;
  try{
    emp = await loginEmployee(state.selectedEmpId, pin);
  }catch(err){
    errEl.textContent = err.message || 'الاسم أو الـ PIN غلط';
    errEl.classList.add('show');
    return;
  }

  state.currentEmployee = emp;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('whoName').textContent = state.currentEmployee.name;
  document.getElementById('adminTag').innerHTML = state.currentEmployee.is_admin ? '<span class="admin-tag">أدمن</span>' : '';
  document.getElementById('manageEmpBtn').classList.toggle('hidden', !state.currentEmployee.is_admin);
  document.getElementById('pinInput').value = '';

  await onEnterApp();
}

export function doLogout(){
  const hasWork = (state.session.mode === 'direct' && state.cart.length) ||
    (state.session.mode === 'persistent' && state.session.order && state.session.order.itemCount());
  if(hasWork && !confirm('السلة لسه فيها أصناف، متأكد إنك عايز تنهي الشيفت؟')) return;
  state.currentEmployee = null;
  state.cart = [];
  state.session = { mode: 'direct', order: null, contextLabel: '' };
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  state.selectedEmpId = null;
  document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('selected'));
}

export const authClickActions = {
  'auth:login': () => doLogin(),
  'auth:logout': () => doLogout(),
};
