// Categories: replaces the hardcoded CATEGORY_LABELS / CATEGORY_ORDER objects
// that used to be duplicated in index.html, admin.html and cashier.html.
// Reads from the `categories` table (see supabase/migrations).

import { sb } from './supabase-client.js';

let cache = null;
let inflight = null;

export async function loadCategories({ force = false } = {}) {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = sb
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .then(({ data, error }) => {
      inflight = null;
      if (error) throw error;
      cache = data || [];
      return cache;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

// Live-refresh whenever an admin adds/edits/removes a category.
export function subscribeCategories(onChange) {
  return sb
    .channel('public:categories')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, async () => {
      await loadCategories({ force: true });
      onChange(cache);
    })
    .subscribe();
}
