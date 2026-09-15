-- Categories table: replaces the hardcoded CATEGORY_LABELS / CATEGORY_ORDER
-- that was duplicated in index.html, admin.html and cashier.html.

create table if not exists categories (
  key text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Seed with the exact categories already hardcoded in the app today.
-- Safe to re-run: does nothing if the keys already exist.
insert into categories (key, name_ar, name_en, sort_order) values
  ('hot', 'المشروبات الساخنة', 'Hot Drinks', 1),
  ('cold', 'المشروبات الباردة', 'Cold Drinks', 2),
  ('shake', 'ميلك شيك', 'Milkshake', 3),
  ('snacks', 'الوجبات الخفيفة', 'Snacks', 4),
  ('beans', 'البُن', 'Coffee Beans', 5)
on conflict (key) do nothing;

alter table categories enable row level security;

-- Everyone (menu, cashier, admin) can read categories.
create policy "categories_public_read"
  on categories for select
  to anon, authenticated
  using (true);

-- Only a logged-in admin (Supabase Auth session in admin.html) can manage categories.
create policy "categories_admin_write_insert"
  on categories for insert
  to authenticated
  with check (true);

create policy "categories_admin_write_update"
  on categories for update
  to authenticated
  using (true)
  with check (true);

create policy "categories_admin_write_delete"
  on categories for delete
  to authenticated
  using (true);
