-- SECURITY FIX: today, `pos_employees` (including the `pin` column) is fully
-- readable by anyone with the public anon key — i.e. anyone who opens the
-- cashier page's dev tools can read every employee's PIN straight from the
-- Network tab. This migration locks the table down completely and adds a
-- PIN-free public view for the login screen.
--
-- ******************************************************************
-- ** IMPORTANT — DO NOT RUN THIS MIGRATION ON ITS OWN.              **
-- ** cashier.html's login / void / delete-expense / manage-employee  **
-- ** flows currently read `pos_employees` directly with the anon key.**
-- ** Once this migration is applied, that direct read returns ZERO   **
-- ** rows and the cashier login screen will show "no employees"      **
-- ** until the three pos-* Edge Functions are deployed AND the       **
-- ** updated cashier.html (already in this repo) is deployed too.    **
-- ** Apply this only as the LAST step, together with the Edge        **
-- ** Function deploys. See SUPABASE ACTION REQUIRED in the PR/report.**
-- ******************************************************************

-- No data is deleted by this migration. It only changes who can read/write the table.

alter table pos_employees enable row level security;

-- Defense in depth: explicitly revoke the default grants too, so a future
-- accidental RLS policy typo can't silently reopen the table.
revoke all on pos_employees from anon, authenticated;

-- Deliberately NO policies are created for anon/authenticated on pos_employees.
-- With RLS enabled and zero policies, every anon/authenticated query returns
-- zero rows and every write is rejected. Only the service_role key (used
-- exclusively inside the Edge Functions, never in browser code) can read/write
-- this table from now on.

-- Public, PIN-free view for the employee picker on the cashier login screen.
create or replace view pos_employees_public as
  select id, name, is_admin
  from pos_employees;

grant select on pos_employees_public to anon, authenticated;
