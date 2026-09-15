// Shared modal helpers: close/open the single #modalRoot, track realtime
// channels opened while a modal is showing (torn down on close), and the
// admin-PIN confirmation prompt reused by void / cancel / delete / manage-employees.

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml } from '../../shared/format.js';
import { verifyAdminPin } from '../../shared/employees.js';

let modalRealtimeChannels = [];
export function trackModalChannel(channel){ modalRealtimeChannels.push(channel); }

export function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
  modalRealtimeChannels.forEach(ch => sb.removeChannel(ch));
  modalRealtimeChannels = [];
}

// Only one modal is ever open at a time (#modalRoot is replaced wholesale),
// so a single pending-callback slot is sufficient.
let pendingAdminPinConfirm = null;

export function openAdminPinPrompt(title, onConfirm){
  pendingAdminPinConfirm = onConfirm;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>${escapeHtml(title)}</h3>
        <p style="text-align:center; font-size:12.5px; color:var(--cream-dim); margin-bottom:14px;">لازم PIN أي أدمن عشان تكمل</p>
        <input class="pin-input" id="adminPinInput" type="password" inputmode="numeric" maxlength="6" placeholder="••••">
        <div class="modal-error" id="adminPinError">PIN غلط — لازم PIN أدمن</div>
        <button class="confirm-btn" data-action="modal:confirmAdminPin">تأكيد</button>
        <button class="close-btn" data-action="modal:close">رجوع</button>
      </div>
    </div>`;
}

async function confirmAdminPin(){
  const pin = document.getElementById('adminPinInput').value.trim();
  const errEl = document.getElementById('adminPinError');
  errEl.classList.remove('show');
  const ok = await verifyAdminPin(pin);
  if(!ok){ errEl.classList.add('show'); return; }
  if(pendingAdminPinConfirm) await pendingAdminPinConfirm();
}

export const modalActions = {
  'modal:close': () => closeModal(),
  'modal:confirmAdminPin': () => confirmAdminPin(),
};
