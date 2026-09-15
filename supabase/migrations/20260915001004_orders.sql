-- Orders / order_items: replaces the localStorage-only invoices in cashier.html
-- with a single Supabase-backed source of truth shared across every cashier device.
--
-- NOTE ON TRUST MODEL: cashier.html logs employees in via PIN only (no real
-- per-employee Supabase Auth session — this is an explicit PRD non-goal), so all
-- cashier writes still go through the public `anon` key, exactly like today.
-- Sensitive actions (void, delete expense, manage employees) are gated by the
-- new pos-verify-admin-pin / pos-manage-employee Edge Functions instead of RLS.

create table if not exists orders (
  id bigint generated always as identity primary key,
  daily_number int not null,
  order_date date not null default current_date,
  order_type text not null check (order_type in ('direct', 'table', 'held', 'takeaway')),
  table_id bigint references tables(id),
  label text,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  employee_id bigint references pos_employees(id) on delete set null,
  employee_name text not null,
  closed_by_employee_id bigint references pos_employees(id) on delete set null,
  closed_by_employee_name text,
  payment_method text check (payment_method in ('cash', 'card')),
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists orders_date_idx on orders (order_date);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_table_idx on orders (table_id) where table_id is not null;

create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  item_id bigint references items(id) on delete set null,
  name_ar text not null,
  price numeric not null,
  qty int not null
);

create index if not exists order_items_order_idx on order_items (order_id);

-- Atomic per-day invoice numbering, safe across multiple cashier tablets at once.
create table if not exists daily_counters (
  order_date date primary key,
  counter int not null default 0
);

create or replace function next_daily_order_number(p_date date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number int;
begin
  insert into daily_counters (order_date, counter)
  values (p_date, 1)
  on conflict (order_date) do update set counter = daily_counters.counter + 1
  returning counter into v_number;
  return v_number;
end;
$$;

grant execute on function next_daily_order_number(date) to anon, authenticated;

alter table orders enable row level security;
alter table order_items enable row level security;
alter table daily_counters enable row level security;

-- orders: cashier (anon) and admin (authenticated) both need full read/write.
-- No delete policy anywhere: cancellation is `status = 'cancelled'`, never a real delete.
create policy "orders_read" on orders for select to anon, authenticated using (true);
create policy "orders_insert" on orders for insert to anon, authenticated with check (true);
create policy "orders_update" on orders for update to anon, authenticated using (true) with check (true);

-- order_items: needs insert/update/delete too, since table/held/takeaway orders
-- are edited live (items added/removed) before the order is completed.
create policy "order_items_read" on order_items for select to anon, authenticated using (true);
create policy "order_items_insert" on order_items for insert to anon, authenticated with check (true);
create policy "order_items_update" on order_items for update to anon, authenticated using (true) with check (true);
create policy "order_items_delete" on order_items for delete to anon, authenticated using (true);

-- daily_counters: only ever touched through next_daily_order_number(), but the
-- function runs as SECURITY DEFINER so no direct table policy is required for it.
-- Policies below exist only as a safety net if something queries the table directly.
create policy "daily_counters_read" on daily_counters for select to anon, authenticated using (true);
