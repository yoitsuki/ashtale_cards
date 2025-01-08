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
    // textContent を正規化して比較
    const buttonText = button.textContent.normalize('NFKC').trim();
    if (buttonText === value) {
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


// フィルター適用（AND/OR切り替え）
function applyFilters() {
  const rows = document.querySelectorAll("tbody tr");
  const searchType = document.querySelector('input[name="searchType"]:checked').value; // AND / OR 取得

  rows.forEach(row => {
    const status = row.getAttribute("data-status").split(",");
    let match = false;

    if (activeFilters.status.length === 0) {
      match = true; // フィルターが空なら全て表示
    } else if (searchType === "AND") {
      match = activeFilters.status.every(filter => status.includes(filter));
    } else if (searchType === "OR") {
      match = activeFilters.status.some(filter => status.includes(filter));
    }

    row.style.display = match ? "" : "none";
  });
}

// フィルターリセット
function resetFilters() {
  activeFilters.status = [];
  document.querySelectorAll("button").forEach(button => button.classList.remove("active"));
  document.querySelectorAll("tbody tr").forEach(row => (row.style.display = ""));
}

// 検索モード変更時にフィルター適用
document.querySelectorAll('input[name="searchType"]').forEach(radio => {
  radio.addEventListener("change", applyFilters);
});

// ページロード時にJSONを取得
document.addEventListener("DOMContentLoaded", loadCards);
