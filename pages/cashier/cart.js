// The session-aware cart: works identically whether the current session is
// a local "direct" walk-up sale (state.cart, nothing persisted yet) or a
// "persistent" table/held/takeaway order (state.session.order, synced to
// Supabase on every change) — see shared/open-order.js for that engine.

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { createPersistentOrder } from '../../shared/open-order.js';
import { state } from './state.js';
import { openAdminPinPrompt, closeModal } from './modal.js';
import { renderCats } from './menu.js';

export function sessionItems(){
  return state.session.mode === 'direct' ? state.cart : state.session.order.getItems();
}
export function sessionTotal(){
  return state.session.mode === 'direct' ? cartTotal() : state.session.order.total();
}
export function qtyInCart(itemId){
  const row = sessionItems().find(c => c.item_id === itemId);
  return row ? row.qty : 0;
}
export function cartTotal(){
  return state.cart.reduce((s,c) => s + c.price*c.qty, 0);
}

export async function sessionChangeQty(itemId, delta){
  const it = state.menuItems.find(m => m.id === itemId);
  if(!it) return;
  if(state.session.mode === 'direct'){
    let row = state.cart.find(c => c.item_id === itemId);
    if(!row && delta > 0){ state.cart.push({ item_id: it.id, name_ar: it.name_ar, price: it.price, qty: 1 }); }
    else if(row){ row.qty += delta; if(row.qty <= 0) state.cart = state.cart.filter(c => c !== row); }
  }else{
    try{
      await state.session.order.changeQty(it, delta);
    }catch(err){
      console.error(err);
      toast('حصل خطأ في حفظ الطلب');
      return;
    }
  }
  renderCart();
  renderCats();
}

export async function removeRow(itemId){
  if(state.session.mode === 'direct'){
    state.cart = state.cart.filter(c => c.item_id !== itemId);
    renderCart(); renderCats();
    return;
  }
  try{
    await state.session.order.changeQty({ id: itemId }, -9999);
  }catch(err){
    console.error(err);
    toast('حصل خطأ في حفظ الطلب');
    return;
  }
  renderCart(); renderCats();
}

export function renderCart(){
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotalTop');
  const listEl = document.getElementById('cartList');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const holdBtn = document.getElementById('holdBtn');

  const items = sessionItems();
  const totalQty = items.reduce((s,c)=>s+c.qty,0);
  countEl.textContent = totalQty ? `${totalQty} صنف في السلة` : 'السلة فاضية';
  totalEl.textContent = sessionTotal() + ' ج';
  checkoutBtn.disabled = items.length === 0;
  holdBtn.classList.toggle('hidden', state.session.mode !== 'direct');

  listEl.innerHTML = items.map((c) => `
    <div class="cart-row">
      <div class="nm">${escapeHtml(c.name_ar)} × ${c.qty}</div>
      <div class="line-total">${c.price*c.qty}</div>
      <button class="btn-cancel" style="flex:none; padding:4px 10px;" data-action="cart:removeRow" data-id="${c.item_id}">✕</button>
    </div>
  `).join('');
}

export function toggleCart(){ document.getElementById('cartBar').classList.toggle('open'); }

export async function handleCancelOrder(){
  const items = sessionItems();
  if(!items.length) return;

  if(state.session.mode === 'direct'){
    if(!confirm('تفريغ السلة بالكامل؟')) return;
    state.cart = [];
    renderCart(); renderCats();
    return;
  }

  // Cancelling an already-persisted table/held/takeaway order affects shared
  // state visible to other cashier devices, so it's admin-PIN gated like void.
  openAdminPinPrompt('تأكيد إلغاء الطلب المفتوح', async () => {
    try{
      await state.session.order.cancel();
      closeModal();
      toast('✓ اتلغى الطلب');
      backToDirectSale();
    }catch(err){
      console.error(err);
      toast('حصل خطأ في الإلغاء');
    }
  });
}

// ---- Hold (direct cart -> held order) ----
export async function handleHoldInvoice(){
  if(!state.cart.length) return;
  const label = prompt('وصف اختياري للفاتورة المعلّقة (سيب فاضي لو مفيش):', '') || null;
  const order = createPersistentOrder({ orderType: 'held', employee: state.currentEmployee });
  try{
    await order.createFromCart(state.cart);
  }catch(err){
    console.error(err);
    toast('حصل خطأ في تعليق الفاتورة');
    return;
  }
  if(label){
    try{ await sb.from('orders').update({ label }).eq('id', order.id); }catch(err){ console.error(err); }
  }
  state.cart = [];
  renderCart(); renderCats();
  document.getElementById('cartBar').classList.remove('open');
  toast('✓ اتعلّقت الفاتورة');
}

// ---- Session switching (tables / takeaway / held) ----
export function confirmLeaveDirectCartIfNeeded(){
  if(state.session.mode === 'direct' && state.cart.length){
    return confirm('السلة الحالية فيها أصناف مش متسجلة لسه، هتتفقد لو كملت. متأكد؟');
  }
  return true;
}

export function enterPersistentSession(order, contextLabel){
  state.session = { mode: 'persistent', order, contextLabel };
  state.cart = [];
  document.getElementById('sessionBanner').classList.remove('hidden');
  document.getElementById('sessionBannerText').textContent = contextLabel;
  renderCart();
  renderCats();
}

export function backToDirectSale(){
  state.session = { mode: 'direct', order: null, contextLabel: '' };
  document.getElementById('sessionBanner').classList.add('hidden');
  renderCart();
  renderCats();
}

export const cartClickActions = {
  'cart:toggle': () => toggleCart(),
  'cart:cancel': () => handleCancelOrder(),
  'cart:hold': () => handleHoldInvoice(),
  'cart:removeRow': (el) => removeRow(Number(el.dataset.id)),
  'cart:backToDirectSale': () => backToDirectSale(),
};
