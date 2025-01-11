const activeFilters = { status: [] };
let cardData = [];

// いいね数取得用
const sheetUrl = "https://script.google.com/macros/s/AKfycbyfyIIgogvBRCp7H3kBOy4sAzd_ojQxoWuVXH4-O2LyGeI2OiqPF9KDtrQnMjjkrgMnyQ/exec"; // Google Apps ScriptのデプロイURL
const pageId = "ash_tale_card"; // ページ固有のID（スプレッドシートのA列に設定）

// いいね数を取得
async function fetchLikes() {
    try {
        const response = await fetch(sheetUrl + "?id=" + pageId);
        const data = await response.json();
        document.getElementById("like-count").textContent = data.likes;
    } catch (error) {
        console.error("いいね数の取得に失敗しました:", error);
    }
}

// いいねを記録
async function likePage() {
  try {
      const formData = new URLSearchParams();
      formData.append("id", pageId);

      const response = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData
      });

      if (!response.ok) throw new Error("サーバーエラー");

      const data = await response.json();
      document.getElementById("like-count").textContent = data.likes;
  } catch (error) {
      console.error("いいねの更新に失敗しました:", error);
  }
}

// ページが読み込まれたら、いいね数を取得
document.addEventListener("DOMContentLoaded", function() {
    fetchLikes();
    document.getElementById("likeButton").addEventListener("click", likePage);
});

// カード用JSONデータを取得
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
  const hasFilters = activeFilters.status.length > 0; // フィルターが1つでもあるか

  rows.forEach(row => {
    const status = row.getAttribute("data-status").split(",");
    let match = false;

    if (!hasFilters) {
      match = true; // フィルターがない場合はすべて表示
    } else if (searchType === "AND") {
      match = activeFilters.status.every(filter => status.includes(filter));
    } else if (searchType === "OR") {
      match = activeFilters.status.some(filter => status.includes(filter));
    }

    row.style.display = match ? "" : "none";

    // ステータスのセルを取得
    const statusCell = row.querySelector("td:nth-child(3)");
    if (statusCell) {
      let html = statusCell.innerHTML;

      // 既存のハイライトをリセット
      html = html.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1");

      // フィルタと一致する単語＋続くテキストを赤くする
      if (hasFilters) {
        activeFilters.status.forEach(filter => {
          const regex = new RegExp(`${filter}[^<]*`, "g"); // フィルタ文字列から始まる単語全体をキャッチ
          html = html.replace(regex, match => `<span class="highlight-text">${match}</span>`);
        });
      }

      statusCell.innerHTML = html;
    }
  });
}

// フィルターリセット
function resetFilters() {
  activeFilters.status = [];

  // 全ボタンのactive状態を解除
  document.querySelectorAll("button").forEach(button => button.classList.remove("active"));

  // 全ての行を表示 & ハイライト解除
  document.querySelectorAll("tbody tr").forEach(row => {
    row.style.display = "";
    
    // ステータス内の赤色をリセット
    const statusCell = row.querySelector("td:nth-child(3)");
    if (statusCell) {
      statusCell.innerHTML = statusCell.innerHTML.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1");
    }
  });
}

// 検索モード変更時にフィルター適用
document.querySelectorAll('input[name="searchType"]').forEach(radio => {
  radio.addEventListener("change", applyFilters);
});

// ページロード時にJSONを取得
document.addEventListener("DOMContentLoaded", loadCards);
