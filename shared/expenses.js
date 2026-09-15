// Expenses data access — replaces the old localStorage getExpenses/saveExpenses.

import { sb } from './supabase-client.js';

export async function fetchExpensesForDate(dateStr) {
  const { data, error } = await sb
    .from('expenses')
    .select('*')
    .eq('expense_date', dateStr)
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addExpense({ employee, name, amount, note }) {
  const { data, error } = await sb
    .from('expenses')
    .insert({ employee_id: employee.id, employee_name: employee.name, name, amount, note: note || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id) {
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export function expensesTotal(expenses) {
  return expenses.reduce((s, e) => s + Number(e.amount), 0);
}
