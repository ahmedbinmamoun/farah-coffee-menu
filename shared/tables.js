// Restaurant tables (the "طاولات" grid in cashier.html) + admin management.

import { sb } from './supabase-client.js';

export async function fetchActiveTables() {
  const { data, error } = await sb
    .from('tables')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchAllTables() {
  const { data, error } = await sb.from('tables').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addTable({ label, sortOrder }) {
  const { data, error } = await sb.from('tables').insert({ label, sort_order: sortOrder ?? 0 }).select().single();
  if (error) throw error;
  return data;
}

export async function setTableActive(id, active) {
  const { error } = await sb.from('tables').update({ active }).eq('id', id);
  if (error) throw error;
}

export function subscribeTables(onChange) {
  return sb
    .channel('public:tables')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, onChange)
    .subscribe();
}
