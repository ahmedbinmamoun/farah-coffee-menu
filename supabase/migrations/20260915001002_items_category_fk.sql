-- Optional data-integrity constraint: items.category must reference a real category.
-- SAFE / NON-DESTRUCTIVE: this only adds a constraint, it does not delete or change
-- any existing data. However it WILL FAIL to apply if any existing row in `items`
-- has a category value that is not one of: hot, cold, shake, snacks, beans.
-- If it fails, just skip this file — everything else in the PRD still works without it,
-- since items.category stays a plain text column either way.
alter table items
  add constraint items_category_fkey
  foreign key (category) references categories(key)
  on delete restrict;
