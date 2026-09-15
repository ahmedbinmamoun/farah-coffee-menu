// Menu/category loading + the item grid (category nav + "+/-" item cards).

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml } from '../../shared/format.js';
import { loadCategories } from '../../shared/categories.js';
import { state } from './state.js';
import { qtyInCart, sessionChangeQty } from './cart.js';

export async function refreshCategories(){
  try{ state.categories = await loadCategories({ force: true }); }catch(err){ console.error(err); }
}

export async function loadMenu(){
  const { data, error } = await sb.from('items').select('*').eq('available', true).order('sort_order');
  if(error){
    document.getElementById('itemsGrid').innerHTML = '<div class="state-msg">تعذّر تحميل المنيو</div>';
    console.error(error);
    return;
  }
  state.menuItems = data || [];
  renderCats();
}

export function renderCats(){
  const groups = {};
  state.menuItems.forEach(it => { (groups[it.category] ||= []).push(it); });
  const activeCats = state.categories.filter(c => groups[c.key] && groups[c.key].length);
  if(!state.currentCat || !activeCats.some(c => c.key === state.currentCat)){
    state.currentCat = activeCats.length ? activeCats[0].key : null;
  }

  const nav = document.getElementById('catNav');
  nav.innerHTML = activeCats.map(c => `<button data-action="menu:selectCat" data-c="${c.key}" class="${c.key===state.currentCat?'active':''}">${escapeHtml(c.name_ar)}</button>`).join('');

  const grid = document.getElementById('itemsGrid');
  const list = state.currentCat ? (groups[state.currentCat] || []) : [];
  grid.innerHTML = list.map(it => itemCardHtml(it)).join('') || '<div class="state-msg">مافي أصناف متاحة في القسم ده</div>';
}

function itemCardHtml(it){
  const qty = qtyInCart(it.id);
  return `
  <div class="item-card ${qty > 0 ? 'has-qty' : ''}">
    <span class="nm">${escapeHtml(it.name_ar)}</span>
    <span class="pr">${it.price} ج</span>
    <div class="qty-row">
      <button data-action="cart:changeQty" data-id="${it.id}" data-delta="-1">−</button>
      <span class="q">${qty}</span>
      <button class="plus" data-action="cart:changeQty" data-id="${it.id}" data-delta="1">+</button>
    </div>
  </div>`;
}

export const menuClickActions = {
  'menu:selectCat': (el) => { state.currentCat = el.dataset.c; renderCats(); },
  'cart:changeQty': (el) => sessionChangeQty(Number(el.dataset.id), Number(el.dataset.delta)),
};
