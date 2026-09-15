-- Expenses: replaces the localStorage-only expenses in cashier.html.

create table if not exists expenses (
  id bigint generated always as identity primary key,
  expense_date date not null default current_date,
  employee_id bigint references pos_employees(id) on delete set null,
  employee_name text not null,
  name text not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses (expense_date);

alter table expenses enable row level security;

create policy "expenses_read" on expenses for select to anon, authenticated using (true);
create policy "expenses_insert" on expenses for insert to anon, authenticated with check (true);
-- Delete is allowed at the RLS level (same anon-key trust model as everything else in
-- cashier.html) but is gated in the UI by the pos-verify-admin-pin Edge Function first.
create policy "expenses_delete" on expenses for delete to anon, authenticated using (true);
