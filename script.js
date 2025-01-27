const activeFilters = { status: [] };
let cardData = [];
let isInitialLoad = true; // 初期表示フラグ

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
  let hasResults = false; // 表示するデータがあるかどうか

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
    hasResults = true; // データがあることを記録
  });

  applyFilters(); // フィルターを適用
  // 検索後に表示されるデータがゼロならばメッセージを追加
  if (!hasResults) {
    const noDataRow = document.createElement("tr");
    noDataRow.innerHTML = `<td colspan="3" style="text-align: center;">該当するデータがありませんでした。</td>`;
    tbody.appendChild(noDataRow);
  }
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
  const searchType = document.querySelector('input[name="searchType"]:checked').value;
  const hasFilters = activeFilters.status.length > 0; // フィルタが適用されているか
  let visibleRowCount = 0; // 表示される行の数をカウント

  // すでにある「該当するデータがありませんでした。」の行を削除
  document.querySelectorAll("tbody .no-data").forEach(row => row.remove());

  // 特別処理が必要なフィルタ
  const specialFilters = {
    "攻撃%": "攻撃",
    "防御%": "防御",
    "HP%": "HP",
    "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ与ダメ増": "対○○与ダメ増",
    "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ被ダメ減": "対○○被ダメ減"
  };

  rows.forEach(row => {
    const statusAttr = row.getAttribute("data-status");
    const status = statusAttr ? statusAttr.split(",") : []; // 属性がnullなら空配列にする
    const category = row.children[1]?.textContent.trim() || ""; // 安全にカテゴリ取得
    let match = false;

    if (!hasFilters) {
      match = true;
    } else if (searchType === "AND") {
      match = activeFilters.status.every(filter => status.includes(filter));
    } else if (searchType === "OR") {
      match = activeFilters.status.some(filter => status.includes(filter));
    }

    row.style.display = match ? "" : "none";
    if (match) visibleRowCount++; // 表示される行が増えたらカウント

    // ステータスセルの強調処理（初回ロード時はスキップ）
    const statusCell = row.querySelector("td:nth-child(3)");
    if (statusCell) {
      let html = statusCell.innerHTML;
      html = html.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1"); // 既存ハイライトをリセット

      // **初回ロード時には赤字を表示しない**
      if (!isInitialLoad) {
        // フィルタ適用時のみ強調表示する
        if (activeFilters.status.length > 0) {
          // フィルタまたはカテゴリに応じて強調表示
          if (category === "武器" || category === "腕") {
            // **武器・腕カテゴリなら全体を赤字**
            html = `<span class="highlight-text">${html}</span>`;
          } else {
            activeFilters.status.forEach(filter => {
              if (specialFilters[filter]) {
                const keyword = specialFilters[filter];
                const regex = new RegExp(`(^|<br>)(${keyword}[-+]?\\d+%?)`, "gi");
                html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
              } else {
                const regex = new RegExp(`(^|<br>)(${filter}[-+]?\\d+%?)`, "gi");
                html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
              }
            });
          }
        }
      }

      statusCell.innerHTML = html;
    }
  });

  // **検索結果がゼロならメッセージ行を追加**
  const tbody = document.querySelector("tbody");
  if (visibleRowCount === 0) {
    const noDataRow = document.createElement("tr");
    noDataRow.innerHTML = `<td colspan="3" class="no-data">該当するデータがありませんでした。</td>`;
    tbody.appendChild(noDataRow);
  }

  // **初回ロード終了後にフラグをオフ**
  if (isInitialLoad) {
    isInitialLoad = false;
  }
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

document.addEventListener("DOMContentLoaded", function() {
  loadCards().then(() => {
    // 初回ロード時にはフィルタを適用しない
    isInitialLoad = true; // 初期表示フラグをONに設定
    applyFilters();
  });
});

