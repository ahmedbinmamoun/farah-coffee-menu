// Tiny shared modal helper used by every admin feature module.

export function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
}

export const modalActions = {
  'modal:close': () => closeModal(),
};
