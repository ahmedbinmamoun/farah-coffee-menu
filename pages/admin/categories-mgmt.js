// إدارة الأقسام: add / rename / reorder / delete categories.

import { sb } from '../../shared/supabase-client.js';
import { escapeHtml, escapeAttr } from '../../shared/format.js';
import { toast } from '../../shared/toast.js';
import { loadCategories } from '../../shared/categories.js';
import { state } from './state.js';
import { closeModal } from './modal.js';
import { renderItemsList } from './items.js';

export async function refreshCategories(){
  try{
    state.categories = await loadCategories({ force: true });
  }catch(err){
    console.error(err);
    toast('تعذّر تحميل الأقسام');
    return;
  }
  renderCategoriesMgmt();
  renderItemsList(); // the items-by-category list also depends on state.categories
}

export function renderCategoriesMgmt(){
  const el = document.getElementById('categoriesMgmt');
  el.innerHTML = `
    ${state.categories.map(cat => {
      const count = state.items.filter(it => it.category === cat.key).length;
      return `
      <div class="mgmt-row">
        <div class="mgmt-names">
          <span>${escapeHtml(cat.name_ar)} <span class="en">— ${escapeHtml(cat.name_en)}</span></span>
          <span class="mgmt-sub">${count} صنف — key: ${escapeHtml(cat.key)}</span>
        </div>
        <div class="mgmt-controls">
          <input class="sort-input" type="number" value="${cat.sort_order}" title="الترتيب" data-action="cat:updateSort" data-key="${cat.key}">
          <button class="delete-btn" title="تعديل الاسم" data-action="cat:editUI" data-key="${cat.key}">✎</button>
          <button class="delete-btn" title="حذف القسم" data-action="cat:delete" data-key="${cat.key}" data-count="${count}">✕</button>
        </div>
      </div>`;
    }).join('') || '<div class="state-msg">مفيش أقسام لسه</div>'}
    <div class="mgmt-add-form">
      <input id="newCatKey" placeholder="key بالإنجليزي (مثال: desserts)">
      <input id="newCatAr" placeholder="اسم القسم بالعربي">
      <input id="newCatEn" placeholder="Category name (English)">
      <button data-action="cat:add">+ إضافة قسم</button>
    </div>`;
}

async function addCategory(){
  const keyInput = document.getElementById('newCatKey');
  const arInput = document.getElementById('newCatAr');
  const enInput = document.getElementById('newCatEn');
  const key = keyInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const name_ar = arInput.value.trim();
  const name_en = enInput.value.trim();

  if(!key || !name_ar || !name_en){
    alert('لازم تكتب key واسم عربي وإنجليزي للقسم');
    return;
  }
  if(state.categories.some(c => c.key === key)){
    alert('فيه قسم بنفس الـ key ده بالفعل');
    return;
  }

  const nextSort = state.categories.length ? Math.max(...state.categories.map(c => c.sort_order || 0)) + 1 : 1;
  const { error } = await sb.from('categories').insert({ key, name_ar, name_en, sort_order: nextSort });
  if(error){ toast('حصل خطأ في إضافة القسم'); console.error(error); return; }

  keyInput.value = ''; arInput.value = ''; enInput.value = '';
  toast('✓ اتضاف القسم');
  await refreshCategories();
}

async function updateCategorySort(key, value){
  const sort_order = Number(value);
  if(isNaN(sort_order)){ toast('ترتيب غير صحيح'); return; }
  const { error } = await sb.from('categories').update({ sort_order }).eq('key', key);
  if(error){ toast('حصل خطأ في الحفظ'); console.error(error); return; }
  toast('✓ اتحفظ الترتيب');
  await refreshCategories();
}

async function deleteCategory(key, itemCount){
  if(itemCount > 0){
    alert('فرّغ القسم من الأصناف الأول قبل ما تحذفه');
    return;
  }
  if(!confirm('متأكد إنك عايز تحذف القسم ده؟')) return;
  const { error } = await sb.from('categories').delete().eq('key', key);
  if(error){ toast('حصل خطأ في الحذف — تأكد إن القسم فاضي من الأصناف'); console.error(error); return; }
  toast('✓ اتحذف القسم');
  await refreshCategories();
}

function editCategoryUI(key){
  const cat = state.categories.find(c => c.key === key);
  if(!cat) return;
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>تعديل اسم القسم</h3>
        <div class="pass-form">
          <input id="editCatAr" value="${escapeAttr(cat.name_ar)}" placeholder="اسم القسم بالعربي">
          <input id="editCatEn" value="${escapeAttr(cat.name_en)}" placeholder="Category name (English)">
          <button data-action="cat:submitEdit" data-key="${key}">حفظ</button>
        </div>
        <div class="modal-error" id="editCatError"></div>
        <button class="close-btn" data-action="modal:close">إلغاء</button>
      </div>
    </div>`;
}

async function submitEditCategory(key){
  const name_ar = document.getElementById('editCatAr').value.trim();
  const name_en = document.getElementById('editCatEn').value.trim();
  const errEl = document.getElementById('editCatError');
  errEl.classList.remove('show');

  if(!name_ar || !name_en){
    errEl.textContent = 'لازم اسم عربي وإنجليزي';
    errEl.classList.add('show');
    return;
  }

  const { error } = await sb.from('categories').update({ name_ar, name_en }).eq('key', key);
  if(error){
    errEl.textContent = 'حصل خطأ: ' + error.message;
    errEl.classList.add('show');
    return;
  }

  closeModal();
  toast('✓ اتحفظ اسم القسم');
  await refreshCategories();
}

export const categoriesClickActions = {
  'cat:add': () => addCategory(),
  'cat:editUI': (el) => editCategoryUI(el.dataset.key),
  'cat:submitEdit': (el) => submitEditCategory(el.dataset.key),
  'cat:delete': (el) => deleteCategory(el.dataset.key, Number(el.dataset.count)),
};

export const categoriesChangeActions = {
  'cat:updateSort': (el) => updateCategorySort(el.dataset.key, el.value),
};
