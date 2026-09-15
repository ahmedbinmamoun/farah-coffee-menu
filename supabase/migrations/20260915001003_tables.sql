-- Tables (physical restaurant tables) used by the cashier's "table" screen.

create table if not exists tables (
  id bigint generated always as identity primary key,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tables enable row level security;

-- Everyone needs to see the table grid (cashier) and its live state.
create policy "tables_public_read"
  on tables for select
  to anon, authenticated
  using (true);

-- Table management (add / rename / deactivate) is an admin.html-only screen
-- (Supabase Auth session required), same trust model as categories.
create policy "tables_admin_write_insert"
  on tables for insert
  to authenticated
  with check (true);

create policy "tables_admin_write_update"
  on tables for update
  to authenticated
  using (true)
  with check (true);
