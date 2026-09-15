// Boots the admin page: wires auth callbacks, merges every feature module's
// data-action registry into one delegated click/change listener, and starts
// realtime subscriptions once the admin is actually logged in.

import { sb } from '../../shared/supabase-client.js';
import { delegate } from '../../shared/dom.js';
import { subscribeCategories } from '../../shared/categories.js';
import { subscribeTables } from '../../shared/tables.js';
import { state } from './state.js';
import { checkSession, doLogin, setAuthCallbacks, authClickActions } from './auth.js';
import { modalActions } from './modal.js';
import { loadItems, itemsClickActions, itemsChangeActions } from './items.js';
import { refreshCategories, categoriesClickActions, categoriesChangeActions } from './categories-mgmt.js';
import { loadTablesMgmt, tablesClickActions } from './tables-mgmt.js';

delegate(document, 'click', {
  ...authClickActions,
  ...modalActions,
  ...itemsClickActions,
  ...categoriesClickActions,
  ...tablesClickActions,
});

delegate(document, 'change', {
  ...itemsChangeActions,
  ...categoriesChangeActions,
});

let realtimeChannel = null;
let categoriesChannel = null;
let tablesChannel = null;

async function enterApp(){
  await loadItems();
  await refreshCategories();
  await loadTablesMgmt();

  if(!realtimeChannel){
    realtimeChannel = sb.channel('public:items:admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => loadItems())
      .subscribe();
  }
  if(!categoriesChannel){
    categoriesChannel = subscribeCategories(async () => { await refreshCategories(); loadItems(); });
  }
  if(!tablesChannel){
    tablesChannel = subscribeTables(() => loadTablesMgmt());
  }

  const menuUrl = window.location.href.replace(/admin\.html.*$/, 'index.html');
  document.getElementById('qrcode').innerHTML = '';
  new QRCode(document.getElementById('qrcode'), {
    text: menuUrl, width: 74, height: 74, colorDark: '#120E0A', colorLight: '#ffffff',
  });
}

function onLogout(){
  if(realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = null;
  // categoriesChannel/tablesChannel are left running — cheap, and re-checking
  // session on next login just reuses them via the `if (!channel)` guards above.
  state.items = [];
  state.categories = [];
  state.tables = [];
}

setAuthCallbacks({ onEnterApp: enterApp, onLogout });

checkSession();

document.getElementById('loginPassword').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') doLogin();
});
