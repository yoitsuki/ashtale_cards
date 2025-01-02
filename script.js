const activeFilters = { status: [] }; // 現在有効なフィルタを保存するオブジェクト

function toggleFilter(type, value) {
  const index = activeFilters[type].indexOf(value);

  // ボタンの状態を切り替え
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    if (button.textContent === value) {
      button.classList.toggle('active', index === -1); // active状態を切り替え
    }
  });

  if (index === -1) {
    // フィルタが未適用の場合、追加
    activeFilters[type].push(value);
  } else {
    // フィルタがすでに適用されている場合、削除
    activeFilters[type].splice(index, 1);
  }
      
  applyFilters(); // フィルタを適用
}

function applyFilters() {
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const status = row.getAttribute('data-status');

    // status属性をカンマで分割
    const statusAttributes = status.split(',').map(attr => attr.trim());

    // AND条件: 全てのフィルタ条件を満たす場合のみ表示
    const statusMatch = activeFilters.status.every(filter =>
      statusAttributes.includes(filter)
    );

    if (statusMatch) {
      row.style.display = ''; // 表示
    } else {
      row.style.display = 'none'; // 非表示
    }
  });
}

function resetFilters() {
  // フィルタをリセット
  activeFilters.status = [];

  // 全ボタンのactive状態を解除
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => button.classList.remove('active'));

  // 全ての行を表示
  const rows = document.querySelectorAll('tbody tr');
  rows.forEach(row => (row.style.display = ''));
}

document.addEventListener('DOMContentLoaded', function() {
  const rows = document.querySelectorAll('tbody tr');
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const closeBtn = document.querySelector('.close');

  rows.forEach(row => {
    row.addEventListener('click', function() {
      const imgSrc = this.getAttribute('data-image');
      if (imgSrc) {
        modal.style.display = 'block';
        modalImg.src = imgSrc;
      }
    });
  });

  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
});
