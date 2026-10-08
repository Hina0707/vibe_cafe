// Supabase 프로젝트의 URL과 공개용 publishable 또는 anon 키를 넣어주세요.
// secret 또는 service_role 키는 브라우저 코드에 넣으면 안 됩니다.
const SUPABASE_URL = 'https://wqswpfvbropdfahiikxs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxc3dwZnZicm9wZGZhaGlpa3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTU1OTQsImV4cCI6MjEwNjk3MTU5NH0.CNLwaLsCMDaE9u3lSV4_68pMHp695bUj02TJboHeCqU';
let supabaseClient = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (error) {
  console.error('Supabase 연결 설정을 확인해주세요.', error);
}

// 저장 여부를 따로 기록하여 Enter 키로도 중복 제출되지 않게 합니다.
let isSaving = false;

// HTML의 id로 주문서와 입력 요소를 찾습니다.
// index.html에서 defer로 연결했으므로 HTML이 준비된 뒤 실행됩니다.
const orderForm = document.getElementById('order-form');
const customerName = document.getElementById('customer-name');
const drinkSelect = document.getElementById('drink');
const quantityInput = document.getElementById('quantity');
const estimatedPrice = document.getElementById('estimated-price');
const orderConfirmation = document.getElementById('order-confirmation');

// 주문 내역은 현재 페이지가 열려 있는 동안 배열에 보관합니다.
// 주문번호는 삭제하더라도 다시 사용하지 않도록 따로 증가시킵니다.
const orders = [];
let nextOrderNumber = 1;
const storageKey = 'vibe-cafe-orders';

// localStorage는 이 브라우저에 문자열을 저장합니다.
// 다른 브라우저나 기기에는 공유되지 않습니다.
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && Array.isArray(saved.orders)) {
    // JSON에는 날짜가 문자열로 저장되므로 Date 객체로 되돌립니다.
    const restored = saved.orders.map((order) => ({ ...order, time: new Date(order.time) }));
    const valid = restored.every((order) =>
      Number.isInteger(order.number) && order.number > 0 &&
      typeof order.name === 'string' && typeof order.drink === 'string' &&
      typeof order.size === 'string' && Array.isArray(order.options) &&
      order.options.every((option) => typeof option === 'string') &&
      Number.isInteger(order.quantity) && order.quantity >= 1 && order.quantity <= 10 &&
      typeof order.requests === 'string' && Number.isFinite(order.amount) && order.amount >= 0 &&
      !Number.isNaN(order.time.getTime()));
    if (valid) {
      orders.push(...restored);
      nextOrderNumber = Math.max(1, ...orders.map((order) => order.number + 1),
        Number.isInteger(saved.nextOrderNumber) ? saved.nextOrderNumber : 1);
    }
  }
} catch (error) {
  // 저장 데이터가 손상되거나 저장소 접근이 막혀도 주문서는 사용할 수 있습니다.
  console.warn('주문 내역을 불러오지 못했습니다.', error);
}

function saveOrders() {
  try {
    // 배열과 다음 주문번호를 JSON 문자열로 바꾸어 저장합니다.
    localStorage.setItem(storageKey, JSON.stringify({ orders, nextOrderNumber }));
  } catch (error) {
    console.warn('주문 내역을 저장하지 못했습니다.', error);
    alert('브라우저에 내역을 저장하지 못했어요. 새로고침하면 내역이 사라질 수 있습니다.');
  }
}

// 연속 주문에도 애니메이션이 처음부터 다시 시작되도록 합니다.
function bounceBadge() {
  const badge = document.getElementById('order-count');
  badge.classList.remove('badge-bounce');
  void badge.offsetWidth;
  badge.classList.add('badge-bounce');
}
const orderTab = document.getElementById('order-tab');
const historyTab = document.getElementById('history-tab');
const orderPanel = document.getElementById('order-panel');
const historyPanel = document.getElementById('history-panel');
const ordersList = document.getElementById('orders-list');

// hidden 클래스를 제거하면 보이고 추가하면 숨겨집니다.
function switchTab(showHistory) {
  orderPanel.classList.toggle('hidden', showHistory);
  historyPanel.classList.toggle('hidden', !showHistory);
  orderTab.classList.toggle('active', !showHistory);
  historyTab.classList.toggle('active', showHistory);
  orderTab.setAttribute('aria-selected', String(!showHistory));
  historyTab.setAttribute('aria-selected', String(showHistory));
}
orderTab.addEventListener('click', () => switchTab(false));
historyTab.addEventListener('click', () => switchTab(true));

// 목록과 건수, 합계는 이 함수에서 함께 갱신합니다.
function renderOrders() {
  ordersList.replaceChildren();
  document.getElementById('order-count').textContent = orders.length;
  document.getElementById('empty-orders').classList.toggle('hidden', orders.length > 0);
  document.getElementById('history-summary').classList.toggle('hidden', orders.length === 0);

  let total = 0;
  const drinkCounts = new Map();
  // 새 주문을 배열 맨 앞에 넣으므로 최신 주문부터 표시됩니다.
  orders.forEach((order) => {
    total += order.amount;
    // 주문 건수가 아닌 수량을 더해 음료별 총 잔 수를 구합니다.
    drinkCounts.set(order.drink, (drinkCounts.get(order.drink) || 0) + order.quantity);
    const card = document.createElement('article');
    card.className = 'order-card';
    const heading = document.createElement('p');
    heading.className = 'order-card-heading';
    heading.textContent = `#${order.number} ${order.name}님 · ${order.amount.toLocaleString('ko-KR')}원`;
    const details = document.createElement('p');
    const options = order.options.length ? ` (${order.options.join(', ')})` : '';
    details.textContent = `${order.drink} ${order.size}사이즈${options} ${order.quantity}잔`;
    const note = document.createElement('p');
    note.className = 'order-card-note';
    const time = order.time.toLocaleString('ko-KR');
    note.textContent = order.requests ? `${order.requests} · ${time}` : time;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'cancel-order';
    cancelButton.textContent = '취소';
    cancelButton.setAttribute('aria-label', `주문 ${order.number}번 취소`);
    cancelButton.addEventListener('click', () => {
      if (!confirm(`#${order.number} 주문을 취소할까요?`)) return;
      const index = orders.findIndex((item) => item.number === order.number);
      if (index !== -1) orders.splice(index, 1);
      saveOrders();
      renderOrders();
    });

    // 입력된 이름과 요청사항은 모두 textContent로 넣습니다.
    // 손님이 HTML을 입력해도 코드로 실행되지 않습니다.
    card.append(heading, details, note, cancelButton);
    ordersList.append(card);
  });
  document.getElementById('orders-total').textContent =
    `총 주문 금액: ${total.toLocaleString('ko-KR')}원 (${orders.length}건)`;
  document.getElementById('drink-summary').textContent = Array.from(drinkCounts,
    ([drink, count]) => `${drink} ${count.toLocaleString('ko-KR')}잔`).join(', ');
}

document.getElementById('clear-orders').addEventListener('click', () => {
  if (!confirm('주문 내역을 모두 지울까요?')) return;
  orders.length = 0;
  saveOrders();
  renderOrders();
});

// 가격 계산은 이 함수에서만 처리합니다.
// 화면에 금액을 표시하고 계산 결과를 반환하여 주문 메시지에도 재사용합니다.
function calculateTotal() {
  let total = 0;

  // 음료를 고른 경우에만 사이즈와 옵션 가격을 더합니다.
  // 음료를 고르지 않았다면 옵션을 선택해도 예상 금액은 0원입니다.
  if (drinkSelect.value !== '') {
    const drinkPrice = Number(drinkSelect.selectedOptions[0].dataset.price);
    const selectedSize = orderForm.querySelector('input[name="size"]:checked');
    const sizePrice = Number(selectedSize.dataset.price);
    const selectedExtras = orderForm.querySelectorAll('input[name="extras"]:checked');

    let extrasPrice = 0;
    selectedExtras.forEach((extra) => {
      // data-price는 문자열이므로 Number로 바꾸고 더합니다.
      extrasPrice += Number(extra.dataset.price);
    });

    // 수량은 1~10 사이의 정수로 맞춥니다.
    // 비어 있거나 숫자가 아니라면 기본값 1을 사용합니다.
    const enteredQuantity = Number(quantityInput.value);
    const quantity = Number.isFinite(enteredQuantity)
      ? Math.min(10, Math.max(1, Math.trunc(enteredQuantity)))
      : 1;
    quantityInput.value = quantity;

    total = (drinkPrice + sizePrice + extrasPrice) * quantity;
  }

  // 한국어 숫자 형식으로 천 단위 쉼표를 붙입니다.
  estimatedPrice.textContent = `예상 금액: ${total.toLocaleString('ko-KR')}원`;
  return total;
}

// 음료, 사이즈, 옵션, 수량이 바뀌면 같은 계산 함수를 실행합니다.
// 수량은 키보드로 입력하는 순간에도 금액이 바뀌도록 input을 사용합니다.
drinkSelect.addEventListener('change', calculateTotal);
quantityInput.addEventListener('input', calculateTotal);
quantityInput.addEventListener('change', calculateTotal);
orderForm.querySelectorAll('input[name="size"], input[name="extras"]').forEach((input) => {
  input.addEventListener('change', calculateTotal);
});

// submit을 사용하면 버튼 클릭과 Enter 입력을 모두 처리할 수 있습니다.
orderForm.addEventListener('submit', async (event) => {
  // 브라우저가 폼을 전송하거나 페이지를 새로고침하지 않도록 막습니다.
  event.preventDefault();
  if (isSaving) return;

  // 공백만 입력한 이름도 빈 이름으로 판단합니다.
  const name = customerName.value.trim();
  if (name === '') {
    alert('이름을 입력해주세요');
    customerName.focus();
    return;
  }

  if (drinkSelect.value === '') {
    alert('음료를 선택해주세요');
    drinkSelect.focus();
    return;
  }

  const total = calculateTotal();
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');

  // 선택 항목의 글자에서 뒤에 붙은 가격을 제거해 음료 이름을 얻습니다.
  const drinkName = drinkSelect.selectedOptions[0].textContent
    .replace(/\s+[\d,]+원\s*$/, '').trim();

  // for와 id로 연결된 라벨에서 옵션 이름을 가져옵니다.
  const extraNames = Array.from(orderForm.querySelectorAll('input[name="extras"]:checked'))
    .map((extra) => extra.labels[0].textContent.replace(/\s+\+[\d,]+원\s*$/, '').trim());

  // 옵션이 있을 때만 괄호를 만들고, 여러 옵션은 쉼표로 연결합니다.
  const extrasText = extraNames.length > 0 ? ` (${extraNames.join(', ')})` : '';

  // await로 저장을 기다리는 동안 입력이 바뀌어도 주문 내용은 유지됩니다.
  const quantity = Number(quantityInput.value);
  const size = selectedSize.value;
  const requests = document.getElementById('requests').value.trim();
  const orderData = {
    customer_name: name,
    phone: document.getElementById('phone').value.trim(),
    drink: drinkName,
    drink_price: Number(drinkSelect.selectedOptions[0].dataset.price),
    size,
    options: extraNames,
    quantity,
    request: requests,
    total_price: total,
  };

  const submitButton = orderForm.querySelector('button[type="submit"]');
  const resetButton = orderForm.querySelector('button[type="reset"]');
  const originalButtonText = submitButton.textContent;
  isSaving = true;
  submitButton.disabled = true;
  resetButton.disabled = true;
  submitButton.textContent = '저장 중…';
  // 이전 주문 메시지는 숨기고 이번 저장 결과를 기다립니다.
  orderConfirmation.hidden = true;

  try {
    if (!supabaseClient) {
      throw new Error('SUPABASE_URL, SUPABASE_KEY 또는 CDN 로딩을 확인해주세요.');
    }
    // 열 이름은 Supabase의 cafe_menu03 테이블과 정확히 같아야 합니다.
    // select를 붙이지 않으므로 저장을 위해 조회 권한까지 요구하지 않습니다.
    const { error } = await supabaseClient.from('cafe_menu03').insert(orderData);
    if (error) throw error;
  } catch (error) {
    console.error('주문 저장 실패:', error);
    alert('주문 저장에 실패했어요');
    return;
  } finally {
    // 성공과 실패 모두 버튼을 원래대로 되돌립니다.
    isSaving = false;
    submitButton.disabled = false;
    resetButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }

  // DB 저장에 성공한 주문만 브라우저 내역에도 추가합니다.
  // unshift는 배열 맨 앞에 추가합니다.
  orders.unshift({
    number: nextOrderNumber++,
    name,
    drink: drinkName,
    size,
    options: extraNames,
    quantity,
    requests,
    amount: total,
    time: new Date(),
  });
  saveOrders();
  renderOrders();
  bounceBadge();

  // textContent를 사용하면 입력한 이름을 HTML이 아닌 글자로 표시합니다.
  orderConfirmation.textContent = `${name}님, ${drinkName} ${size}사이즈${extrasText} ${quantity}잔, 총 ${total.toLocaleString('ko-KR')}원 주문이 접수되었습니다!`;
  orderConfirmation.hidden = false;
  orderConfirmation.classList.remove('hidden');
});

// reset 버튼은 HTML에 지정한 기본값(M 사이즈, 수량 1)으로 돌아갑니다.
orderForm.addEventListener('reset', () => {
  orderConfirmation.textContent = '';
  orderConfirmation.hidden = true;

  // reset 이벤트 시점에는 입력값이 아직 초기화되기 전입니다.
  // 기본 초기화가 끝난 다음 계산하여 예상 금액을 0원으로 표시합니다.
  setTimeout(calculateTotal, 0);
});

// 처음 페이지를 열었을 때도 현재 선택 상태에 맞는 금액을 표시합니다.
calculateTotal();
renderOrders();
