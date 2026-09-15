// Shared toast() notification, used by admin.html and cashier.html.
// Expects a `<div class="toast" id="toast"></div>` element in the page
// (both pages already define the matching CSS).

let toastEl = null;

export function toast(msg) {
  if (!toastEl) toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
