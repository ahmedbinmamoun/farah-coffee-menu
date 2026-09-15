// Event delegation helper. Dynamically-rendered HTML (built via innerHTML
// template strings, which every page here does heavily) never needs inline
// onclick="..."/onchange="..." or a manual `window.fn = fn` exposure list —
// one listener on `root` handles every current AND future element with a
// matching [data-action] underneath it, including elements rendered later.
//
// Usage: give an element `data-action="cart:changeQty" data-id="12" data-delta="1"`,
// then register `delegate(document, 'click', { 'cart:changeQty': (el) => {...} })`.
// The handler receives the matched element (read data-* off it) and the raw event.

export function delegate(root, eventType, actions) {
  root.addEventListener(eventType, (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const handler = actions[el.dataset.action];
    if (handler) handler(el, e);
  });
}
