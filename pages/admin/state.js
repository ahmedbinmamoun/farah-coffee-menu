// Small mutable state shared across the admin page's feature modules.
// Plain object + direct mutation (no framework) — every module imports the
// same `state` reference, so a change made in one module is immediately
// visible to the others without any event bus.

export const state = {
  categories: [],
  tables: [],
  items: [],
};
