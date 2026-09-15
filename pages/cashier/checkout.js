// Payment modal + finalizing a sale (direct checkout or completing a
// persistent table/held/takeaway order).

import { createDirectOrder } from '../../shared/orders.js';
import { state } from './state.js';
import { closeModal } from './modal.js';
import { sessionItems, sessionTotal, renderCart, backToDirectSale } from './cart.js';
import { renderCats } from './menu.js';

export function openPaymentModal(){
  if(!sessionItems().length) return;
  state.pendingPayment = null;
  const total = sessionTotal();
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>طريقة الدفع</h3>
        <div class="modal-total">${total} ج</div>
        <div class="pay-options">
          <button id="payCash" data-action="checkout:selectPayment" data-method="cash">💵 كاش</button>
          <button id="payCard" data-action="checkout:selectPayment" data-method="card">💳 بنكك</button>
        </div>
        <button class="confirm-btn" data-action="checkout:confirmSale">تأكيد البيع</button>
        <button class="close-btn" data-action="modal:close">رجوع</button>
      </div>
    </div>`;
}

function selectPayment(method){
  state.pendingPayment = method;
  document.getElementById('payCash').classList.toggle('selected', method==='cash');
  document.getElementById('payCard').classList.toggle('selected', method==='card');
}

async function confirmSale(){
  if(!state.pendingPayment){ alert('اختار طريقة الدفع الأول'); return; }

  try{
    let number, total;
    if(state.session.mode === 'direct'){
      const order = await createDirectOrder({ cartItems: state.cart, employee: state.currentEmployee, paymentMethod: state.pendingPayment });
      number = order.daily_number;
      total = order.total;
      state.cart = [];
    }else{
      const result = await state.session.order.complete(state.pendingPayment, state.currentEmployee);
      number = result.dailyNumber;
      total = result.total;
      backToDirectSale();
    }
    renderCart();
    renderCats();
    document.getElementById('cartBar').classList.remove('open');
    closeModal();
    alert(`تم البيع — فاتورة رقم ${number} بقيمة ${total} ج`);
  }catch(err){
    console.error(err);
    alert('حصل خطأ أثناء إتمام البيع، حاول تاني');
  }
}

export const checkoutClickActions = {
  'checkout:open': () => openPaymentModal(),
  'checkout:selectPayment': (el) => selectPayment(el.dataset.method),
  'checkout:confirmSale': () => confirmSale(),
};
