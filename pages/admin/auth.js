// Supabase Auth session (login/logout) + admin password change.
// The actual "load everything and start realtime" work on entering the app,
// and "stop realtime" on logout, are owned by main.js and injected here via
// setAuthCallbacks — this module only knows about the login screen and auth.

import { sb } from '../../shared/supabase-client.js';
import { toast } from '../../shared/toast.js';
import { closeModal } from './modal.js';

const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const loginError = document.getElementById('loginError');

let onEnterApp = () => {};
let onLogout = () => {};
export function setAuthCallbacks({ onEnterApp: enter, onLogout: exit }){
  onEnterApp = enter;
  onLogout = exit;
}

function enterAppUI(){
  loginScreen.classList.add('app-hidden');
  adminApp.classList.remove('app-hidden');
  onEnterApp();
}

export async function checkSession(){
  const { data: { session } } = await sb.auth.getSession();
  if(session){
    enterAppUI();
  }else{
    loginScreen.classList.remove('app-hidden');
    adminApp.classList.add('app-hidden');
  }
}

export async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  loginError.classList.remove('show');

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    loginError.textContent = 'البريد أو كلمة المرور غلط';
    loginError.classList.add('show');
    return;
  }
  enterAppUI();
}

export async function doLogout(){
  await sb.auth.signOut();
  onLogout();
  loginScreen.classList.remove('app-hidden');
  adminApp.classList.add('app-hidden');
  document.getElementById('loginPassword').value = '';
}

export function openChangePassword(){
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>تغيير كلمة المرور</h3>
        <div class="pass-form">
          <input type="password" id="newPass1" placeholder="كلمة المرور الجديدة" autocomplete="new-password">
          <input type="password" id="newPass2" placeholder="تأكيد كلمة المرور" autocomplete="new-password">
          <button data-action="auth:submitPasswordChange">تغيير كلمة المرور</button>
        </div>
        <div class="modal-error" id="passError"></div>
        <button class="close-btn" data-action="modal:close">إلغاء</button>
      </div>
    </div>`;
}

async function submitPasswordChange(){
  const p1 = document.getElementById('newPass1').value;
  const p2 = document.getElementById('newPass2').value;
  const errEl = document.getElementById('passError');
  errEl.classList.remove('show');

  if(!p1 || p1.length < 6){
    errEl.textContent = 'كلمة المرور لازم تكون 6 حروف/أرقام على الأقل';
    errEl.classList.add('show');
    return;
  }
  if(p1 !== p2){
    errEl.textContent = 'كلمتا المرور مش متطابقتين';
    errEl.classList.add('show');
    return;
  }

  const { error } = await sb.auth.updateUser({ password: p1 });
  if(error){
    errEl.textContent = 'حصل خطأ: ' + error.message;
    errEl.classList.add('show');
    return;
  }

  closeModal();
  toast('✓ اتغيرت كلمة المرور');
}

export const authClickActions = {
  'auth:login': () => doLogin(),
  'auth:logout': () => doLogout(),
  'auth:openChangePassword': () => openChangePassword(),
  'auth:submitPasswordChange': () => submitPasswordChange(),
};
