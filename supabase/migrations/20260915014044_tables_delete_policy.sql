-- Adds the ability to hard-delete a table from admin.html's "إدارة الترابيزات".
-- Safe / additive: only adds an RLS policy, no data is touched.
--
-- The delete itself will still fail with a foreign key violation if that
-- table has any order history (orders.table_id references tables.id with no
-- ON DELETE action) — that's intentional, so past orders are never silently
-- orphaned. Deactivate the table instead in that case.

create policy "tables_admin_write_delete"
  on tables for delete
  to authenticated
  using (true);
