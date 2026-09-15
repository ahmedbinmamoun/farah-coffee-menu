// Employee data access. `pos_employees` (and its `pin` column) is locked
// down by RLS — the only allowed reads/writes go through:
//  - `pos_employees_public` (id, name, is_admin — no pin) for the login picker
//  - the pos-login / pos-verify-admin-pin / pos-manage-employee Edge Functions
//    for everything that needs the PIN itself.
// No PIN ever travels through anything except these function calls, and it's
// only ever compared server-side (see supabase/functions/pos-*).

import { sb } from './supabase-client.js';

export async function fetchEmployeesPublic() {
  const { data, error } = await sb.from('pos_employees_public').select('*').order('id');
  if (error) throw error;
  return data || [];
}

export async function loginEmployee(employeeId, pin) {
  const { data, error } = await sb.functions.invoke('pos-login', {
    body: { employee_id: employeeId, pin },
  });
  if (error) {
    const msg = (await readFunctionError(error)) || 'الاسم أو الـ PIN غلط';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data; // { id, name, is_admin }
}

export async function verifyAdminPin(pin) {
  const { data, error } = await sb.functions.invoke('pos-verify-admin-pin', {
    body: { pin },
  });
  if (error) return false;
  return !!data?.is_admin;
}

export async function addEmployee({ adminPin, name, pin, isAdmin }) {
  const { data, error } = await sb.functions.invoke('pos-manage-employee', {
    body: { admin_pin: adminPin, action: 'add', payload: { name, pin, is_admin: isAdmin } },
  });
  if (error) {
    const msg = (await readFunctionError(error)) || 'حصل خطأ في الإضافة';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.employee;
}

export async function updateEmployee({ adminPin, id, name, pin, isAdmin }) {
  const payload = { id };
  if (name !== undefined) payload.name = name;
  if (pin) payload.pin = pin; // empty/omitted pin means "leave it unchanged"
  if (isAdmin !== undefined) payload.is_admin = isAdmin;

  const { data, error } = await sb.functions.invoke('pos-manage-employee', {
    body: { admin_pin: adminPin, action: 'update', payload },
  });
  if (error) {
    const msg = (await readFunctionError(error)) || 'حصل خطأ في التعديل';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.employee;
}

export async function deleteEmployee({ adminPin, id }) {
  const { data, error } = await sb.functions.invoke('pos-manage-employee', {
    body: { admin_pin: adminPin, action: 'delete', payload: { id } },
  });
  if (error) {
    const msg = (await readFunctionError(error)) || 'حصل خطأ في الحذف';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return true;
}

// supabase-js throws a generic FunctionsHttpError; the real message is in the
// response body, which we need to read out manually.
async function readFunctionError(error) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      return body?.error;
    }
  } catch {
    // ignore, fall back to generic message
  }
  return null;
}
