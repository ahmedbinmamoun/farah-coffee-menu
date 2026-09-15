// Public menu page: loads items + categories, renders the category nav and
// cards, and handles the image lightbox. No auth, no writes — read-only.

import { sb } from '../../shared/supabase-client.js';
import { loadCategories, subscribeCategories } from '../../shared/categories.js';
import { escapeHtml, escapeAttr } from '../../shared/format.js';
import { delegate } from '../../shared/dom.js';

// A simple elegant cup glyph used whenever an item has no photo yet
const CUP_GLYPH = `<span class="glyph"><svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 18h22v14a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8V18Z" stroke="#C9A44D" stroke-width="1.4"/>
  <path d="M32 21h3a5 5 0 0 1 0 10h-3" stroke="#C9A44D" stroke-width="1.4"/>
  <path d="M15 12c0-1.5 1.2-2 1.2-3.5S15 6 15 6" stroke="#C9A44D" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M21 12c0-1.5 1.2-2 1.2-3.5S21 6 21 6" stroke="#C9A44D" stroke-width="1.2" stroke-linecap="round"/>
</svg></span>`;

const nav = document.getElementById('catNav');
const mainEl = document.getElementById('menuMain');
let CATEGORIES = [];
let currentCat = null;
let lastItems = [];

async function loadMenu(){
  try{
    CATEGORIES = await loadCategories();
  }catch(err){
    console.error(err);
  }

  const { data, error } = await sb
    .from('items')
    .select('*')
    .order('sort_order', { ascending: true });

  if(error){
    mainEl.innerHTML = `<div class="state-msg">تعذّر تحميل المنيو حاليًا، حاول تاني بعد شوية.</div>`;
    console.error(error);
    return;
  }

  lastItems = data || [];
  render(lastItems);
}

function render(items){
  const groups = {};
  items.forEach(it => {
    if(!groups[it.category]) groups[it.category] = [];
    groups[it.category].push(it);
  });

  const activeCats = CATEGORIES.filter(c => groups[c.key] && groups[c.key].length);

  if(!activeCats.length){
    mainEl.innerHTML = `<div class="state-msg">المنيو فاضي دلوقتي.</div>`;
    nav.innerHTML = '';
    return;
  }

  if(!currentCat || !activeCats.some(c => c.key === currentCat)) currentCat = activeCats[0].key;

  nav.innerHTML = activeCats.map(c => `
    <button data-action="menu:selectCat" data-cat="${c.key}" class="${c.key === currentCat ? 'active' : ''}">${escapeHtml(c.name_ar)}</button>
  `).join('');

  mainEl.innerHTML = activeCats.map(c => `
    <section class="category ${c.key === currentCat ? 'active' : ''}">
      <h2 class="category-title">${escapeHtml(c.name_ar)} <span class="en">— ${escapeHtml(c.name_en)}</span></h2>
      <div class="card-list">
        ${groups[c.key].map((it, i) => cardHtml(it, i)).join('')}
      </div>
    </section>
  `).join('');
}

function cardHtml(it, i){
  const delay = Math.min(i * 55, 500);
  return `
  <div class="card ${it.available ? '' : 'unavailable'}" style="animation-delay:${delay}ms">
    <div class="card-media">
      ${it.image_url ? `<img src="${escapeAttr(it.image_url)}" alt="" loading="lazy" data-action="menu:openLightbox" data-url="${escapeAttr(it.image_url)}">` : CUP_GLYPH}
    </div>
    <div class="card-body">
      <div class="card-names">
        <div class="name-ar">${escapeHtml(it.name_ar)}</div>
        <div class="name-en en">${escapeHtml((it.name_en || '').toUpperCase())}</div>
      </div>
      ${it.available ? `<div class="price">${it.price} ج</div>` : `<div class="out-tag">خلص الليلة</div>`}
    </div>
  </div>`;
}

function openLightbox(url){
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = url;
  lb.classList.add('show');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('show');
}

delegate(document, 'click', {
  'menu:selectCat': (el) => { currentCat = el.dataset.cat; render(lastItems); },
  'menu:openLightbox': (el) => openLightbox(el.dataset.url),
  'menu:closeLightbox': () => closeLightbox(),
});

// Initial load
loadMenu();

// Realtime: re-render instantly whenever admin changes items or categories
sb.channel('public:items')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
    loadMenu();
  })
  .subscribe();

subscribeCategories(() => loadMenu());
