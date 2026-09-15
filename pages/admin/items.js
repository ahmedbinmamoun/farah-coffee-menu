// Menu items: list (grouped by category), price/availability edits, photo
// upload, add/delete. This is the "إدارة الأقسام"-adjacent items list.

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml, escapeAttr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { state } from './state.js';
import { renderCategoriesMgmt } from './categories-mgmt.js';

const wrap = document.getElementById('categories');
const statusBadge = document.getElementById('statusBadge');

export async function loadItems(){
  const { data, error } = await sb
    .from('items')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if(error){
    wrap.innerHTML = `<div class="state-msg">تعذّر تحميل الأصناف — تأكد من اتصال الإنترنت وحاول تاني.</div>`;
    statusBadge.textContent = 'غير متصل';
    statusBadge.classList.remove('live');
    console.error(error);
    return;
  }

  state.items = data || [];
  statusBadge.textContent = 'متصل ومتزامن مباشرة';
  renderItemsList();
  if(state.categories.length) renderCategoriesMgmt(); // item counts shown there depend on state.items
}

export function renderItemsList(){
  const groups = {};
  state.items.forEach(it => {
    if(!groups[it.category]) groups[it.category] = [];
    groups[it.category].push(it);
  });

  if(!state.categories.length){
    wrap.innerHTML = `<div class="state-msg">مافي أقسام لسه — ضيف قسم من "إدارة الأقسام" فوق.</div>`;
    return;
  }

  wrap.innerHTML = state.categories.map(cat => {
    const catKey = cat.key;
    const list = groups[catKey] || [];
    return `
    <div class="category-block">
      <h2 class="category-title">${escapeHtml(cat.name_ar)} <span class="en">— ${escapeHtml(cat.name_en)}</span></h2>
      <div class="items-list">
        ${list.map(itemRow).join('') || '<div style="font-size:12px;color:var(--gold-soft);padding:8px 0;">مافي أصناف في القسم ده لسه</div>'}
      </div>
      <button class="add-item-btn" data-action="items:showAddForm" data-cat="${catKey}">+ إضافة صنف جديد في ${escapeHtml(cat.name_ar)}</button>
      <div class="add-form" id="form-${catKey}">
        <input class="name-field" id="new-ar-${catKey}" placeholder="اسم الصنف بالعربي">
        <input class="name-field" id="new-en-${catKey}" placeholder="Item name (English)">
        <input class="price-field" id="new-price-${catKey}" type="number" placeholder="السعر">
        <label class="name-field" style="flex:1 1 100%; background:var(--surface-2); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:12px; color:var(--gold-soft); cursor:pointer; display:flex; align-items:center; gap:6px;">
          📷 <span id="new-img-label-${catKey}">اختياري: اضغط لرفع صورة الصنف</span>
          <input type="file" accept="image/*" id="new-img-${catKey}" style="display:none;" data-action="items:newImageSelected" data-cat="${catKey}">
        </label>
        <button data-action="items:addItem" data-cat="${catKey}">إضافة</button>
      </div>
    </div>`;
  }).join('');
}

function itemRow(it){
  return `
  <div class="item ${it.available ? '' : 'unavailable'}" id="item-${it.id}">
    <div class="item-thumb" id="thumb-${it.id}">
      ${it.image_url ? `<img src="${escapeAttr(it.image_url)}" alt="">` : `<div class="thumb-empty">لا توجد صورة</div>`}
      <div class="upload-overlay">📷</div>
      <input type="file" accept="image/*" data-action="items:uploadImage" data-id="${it.id}">
    </div>
    <div class="item-main">
      <div class="item-names">
        <div class="name-ar">${escapeHtml(it.name_ar)}</div>
        <div class="name-en en">${escapeHtml((it.name_en || '').toUpperCase())}</div>
      </div>
      <div class="photo-hint">دوس على الصورة لرفع/تغيير صورة الصنف</div>
    </div>
    <div class="item-controls">
      <input class="price-input" type="number" value="${it.price}" data-action="items:updatePrice" data-id="${it.id}">
      <button class="avail-toggle ${it.available ? 'on' : ''}" data-action="items:toggleAvail" data-id="${it.id}"></button>
      <button class="delete-btn" title="حذف الصنف" data-action="items:delete" data-id="${it.id}">✕</button>
    </div>
  </div>`;
}

async function uploadImage(id, file){
  if(!file) return;
  const thumbEl = document.getElementById('thumb-' + id);
  thumbEl.classList.add('uploading');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `items/${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage.from('menu-images').upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg'
  });

  if(uploadError){
    thumbEl.classList.remove('uploading');
    toast('حصل خطأ في رفع الصورة');
    console.error(uploadError);
    return;
  }

  const { data: urlData } = sb.storage.from('menu-images').getPublicUrl(path);
  const image_url = urlData.publicUrl;

  const { error: dbError } = await sb.from('items').update({ image_url }).eq('id', id);
  thumbEl.classList.remove('uploading');

  if(dbError){
    toast('اتحفظت الصورة بس حصل خطأ في تحديث الصنف');
    console.error(dbError);
    return;
  }

  toast('✓ اتحفظت الصورة');
}

async function updatePrice(id, value){
  const price = Number(value);
  if(isNaN(price) || price < 0){ toast('السعر غير صحيح'); return; }
  const { error } = await sb.from('items').update({ price }).eq('id', id);
  if(error){ toast('حصل خطأ في الحفظ'); console.error(error); return; }
  toast('✓ اتحفظ السعر');
}

async function toggleAvail(id, btn){
  const newVal = !btn.classList.contains('on');
  const { error } = await sb.from('items').update({ available: newVal }).eq('id', id);
  if(error){ toast('حصل خطأ في الحفظ'); console.error(error); return; }
  btn.classList.toggle('on', newVal);
  document.getElementById('item-' + id).classList.toggle('unavailable', !newVal);
  toast(newVal ? '✓ الصنف بقى متاح' : '✓ الصنف اتوقف مؤقتًا');
}

async function deleteItem(id){
  if(!confirm('متأكد إنك عايز تحذف الصنف ده؟')) return;
  const { error } = await sb.from('items').delete().eq('id', id);
  if(error){ toast('حصل خطأ في الحذف'); console.error(error); return; }
  toast('✓ اتحذف الصنف');
}

function showAddForm(catKey){
  document.getElementById('form-' + catKey).classList.toggle('show');
}

async function addItem(catKey){
  const arInput = document.getElementById('new-ar-' + catKey);
  const enInput = document.getElementById('new-en-' + catKey);
  const priceInput = document.getElementById('new-price-' + catKey);
  const imgInput = document.getElementById('new-img-' + catKey);
  const name_ar = arInput.value.trim();
  const name_en = enInput.value.trim();
  const price = Number(priceInput.value);
  const file = imgInput.files[0] || null;

  if(!name_ar || !price){
    alert('لازم تكتب اسم الصنف بالعربي والسعر على الأقل');
    return;
  }

  const sameCatItems = state.items.filter(it => it.category === catKey);
  const nextSort = sameCatItems.length ? Math.max(...sameCatItems.map(it => it.sort_order || 0)) + 1 : 1;

  const { data: inserted, error } = await sb.from('items').insert({
    category: catKey, name_ar, name_en: name_en || name_ar, price, available: true, sort_order: nextSort
  }).select().single();

  if(error){ toast('حصل خطأ في الإضافة'); console.error(error); return; }

  // If a photo was chosen, upload it now and attach it to the item we just created
  if(file && inserted){
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `items/${inserted.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await sb.storage.from('menu-images').upload(path, file, {
      upsert: true, contentType: file.type || 'image/jpeg'
    });
    if(!uploadError){
      const { data: urlData } = sb.storage.from('menu-images').getPublicUrl(path);
      await sb.from('items').update({ image_url: urlData.publicUrl }).eq('id', inserted.id);
    }else{
      console.error(uploadError);
      toast('اتضاف الصنف لكن حصل خطأ في رفع الصورة');
    }
  }

  arInput.value = ''; enInput.value = ''; priceInput.value = ''; imgInput.value = '';
  document.getElementById('new-img-label-' + catKey).textContent = 'اختياري: اضغط لرفع صورة الصنف';
  document.getElementById('form-' + catKey).classList.remove('show');
  toast('✓ اتضاف الصنف');
}

export const itemsClickActions = {
  'items:showAddForm': (el) => showAddForm(el.dataset.cat),
  'items:addItem': (el) => addItem(el.dataset.cat),
  'items:toggleAvail': (el) => toggleAvail(Number(el.dataset.id), el),
  'items:delete': (el) => deleteItem(Number(el.dataset.id)),
};

export const itemsChangeActions = {
  'items:uploadImage': (el) => uploadImage(Number(el.dataset.id), el.files[0]),
  'items:updatePrice': (el) => updatePrice(Number(el.dataset.id), el.value),
  'items:newImageSelected': (el) => {
    const label = document.getElementById('new-img-label-' + el.dataset.cat);
    label.textContent = el.files[0] ? el.files[0].name : 'اختياري: اضغط لرفع صورة الصنف';
  },
};
