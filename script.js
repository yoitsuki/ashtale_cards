const activeFilters = { status: [] };
let cardData = [];

// JSONデータを取得
async function loadCards() {
  try {
    const response = await fetch("cards.json");
    cardData = await response.json();
    renderTable();
  } catch (error) {
    console.error("カードデータの取得に失敗しました:", error);
  }
}

// テーブルを動的に生成
function renderTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = ""; // 既存のデータをクリア

  cardData.forEach(card => {
    const row = document.createElement("tr");
    row.setAttribute("data-status", card.status.join(","));

    row.innerHTML = `
      <td><img src="${card.icon}" alt="${card.name}" class="icon-img"><br>${card.name}</td>
      <td>${card.category}</td>
      <td>${card.full_status.join("<br>")}</td>
    `;

    row.addEventListener("click", function() {
      openModal(card.image);
    });

    tbody.appendChild(row);
  });

  applyFilters(); // フィルターを適用
}

// モーダルの開閉（大画像）
function openModal(imageSrc) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  modal.style.display = "block";
  modalImg.src = imageSrc;
}

document.querySelector(".close").addEventListener("click", function() {
  document.getElementById("imageModal").style.display = "none";
});

window.addEventListener("click", function(event) {
  if (event.target === document.getElementById("imageModal")) {
    document.getElementById("imageModal").style.display = "none";
  }
});

// フィルター機能
function toggleFilter(type, value) {
  const index = activeFilters[type].indexOf(value);

  document.querySelectorAll('button').forEach(button => {
    if (button.textContent === value) {
      button.classList.toggle("active", index === -1);
    }
  });

  if (index === -1) {
    activeFilters[type].push(value);
  } else {
    activeFilters[type].splice(index, 1);
  }

  applyFilters();
}

// フィルター適用
function applyFilters() {
  const rows = document.querySelectorAll("tbody tr");

  rows.forEach(row => {
    const status = row.getAttribute("data-status").split(",");
    const match = activeFilters.status.every(filter => status.includes(filter));

    row.style.display = match ? "" : "none";
  });
}

// フィルターリセット
function resetFilters() {
  activeFilters.status = [];
  document.querySelectorAll("button").forEach(button => button.classList.remove("active"));
  document.querySelectorAll("tbody tr").forEach(row => (row.style.display = ""));
}

// ページロード時にJSONを取得
document.addEventListener("DOMContentLoaded", loadCards);
// 既存の手書きテーブル行にモーダルイベントを適用
document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll("tbody tr").forEach(row => {
    const imageSrc = row.getAttribute("data-image"); // data-image 属性から画像取得
    if (imageSrc) {
      row.addEventListener("click", function() {
        openModal(imageSrc);
      });
    }
  });
});
