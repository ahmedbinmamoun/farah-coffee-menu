// Small formatting/escaping helpers shared by index.html, admin.html and cashier.html.
// Previously copy-pasted with slightly different implementations in each file.

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

export function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function timeStr(date = new Date()) {
  return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
