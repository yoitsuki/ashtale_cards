let activeFilters = { status: [], rare: [], rank: [], category: [] };
let cardData = [];
let isInitialLoad = true; // 初期表示フラグ
// 特殊フィルタ変換マップ（ボタン名 → 実際の検索キー）
const specialFilters = {
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ与ダメ増": "対○○与ダメ増",
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ被ダメ減": "対○○被ダメ減",
  "攻撃%": "攻撃",
  "防御%": "防御",
  "HP%": "HP"
};
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
    row.setAttribute("data-rare", card.rare || "");
    row.setAttribute("data-rank", card.rank || "");
    
    
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
  if (!activeFilters[type]) activeFilters[type] = []; // 未定義の場合は空配列として初期化
  const convertedValue = specialFilters[value] || value;
  const index = activeFilters[type].indexOf(convertedValue);

  document.querySelectorAll('button').forEach(button => {
    // textContent を正規化して比較
    const buttonText = button.textContent.trim();
    if (buttonText === value) {
      button.classList.toggle("active", index === -1);
    }
  });

  if (index === -1) {
    activeFilters[type].push(convertedValue);
  } else {
    activeFilters[type] = activeFilters[type].filter(item => item !== convertedValue);
  }

  applyFilters();
}

// フィルター適用（AND/OR切り替え）
function applyFilters() {
  const rows = document.querySelectorAll("tbody tr");
  const searchType = document.querySelector('input[name="searchType"]:checked').value;
  const hasStatusFilters = activeFilters.status.length > 0; 
  const hasRareFilters = activeFilters.rare.length > 0;
  const hasRankFilters = activeFilters.rank.length > 0;
  const hasCategoryFilters = activeFilters.category.length > 0;
  let visibleRowCount = 0; // 表示される行の数をカウント

  // すでにある「該当するデータがありませんでした。」の行を削除
  document.querySelectorAll("tbody .no-data").forEach(row => row.remove());

  rows.forEach(row => {
    const statusAttr = row.getAttribute("data-status");
    const status = statusAttr ? statusAttr.split(",") : []; // 属性がnullなら空配列にする
    const rare = row.getAttribute("data-rare");
    const rank = row.getAttribute("data-rank");
    const category = row.children[1]?.textContent.trim() || ""; // カテゴリ取得
    const statusCell = row.querySelector("td:nth-child(3)"); // ステータス列取得

    // **特殊フィルタを適用**
    let transformedStatus = status.map(s => specialFilters[s] || s);

    let matchStatus = !hasStatusFilters || (searchType === "AND" 
      ? activeFilters.status.every(filter => transformedStatus.includes(filter)) 
      : activeFilters.status.some(filter => transformedStatus.includes(filter)));

    let matchRare = !hasRareFilters || activeFilters.rare.includes(rare);
    let matchRank = !hasRankFilters || activeFilters.rank.includes(rank);
    let matchCategory = !hasCategoryFilters || activeFilters.category.includes(category); // カテゴリ判定

    let match = matchStatus && matchRare && matchRank && matchCategory;
    row.style.display = match ? "" : "none";
    if (match) visibleRowCount++;

        // **ステータスの強調（赤字）**
        if (statusCell) {
          let html = statusCell.innerHTML;
          html = html.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1"); // 既存ハイライトをリセット

          if (activeFilters.status.length > 0) {
              activeFilters.status.forEach(filter => {
                  let convertedFilter = specialFilters[filter] || filter;
                  const regex = new RegExp(`(^|<br>)(${convertedFilter}[-+]?\\d+%?)`, "gi");
                  html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
              });
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
  activeFilters = { status: [], rare: [], rank: [], category: [] };
/* 
  activeFilters.category.length = 0;
  activeFilters.rare.length = 0;
  activeFilters.rank.length = 0;
  activeFilters.status.length = 0;
 */
  // 全ボタンのactive状態を解除
  document.querySelectorAll(".filter-group button").forEach(button => {
    button.classList.remove("active");
  });

  // 全ての行を表示 & ハイライト解除
  document.querySelectorAll("tbody tr").forEach(row => {
    row.style.display = "";

    // カテゴリ内の赤色をリセット
    const categoryCell = row.querySelector("td:nth-child(2)");
    if (categoryCell) {
      categoryCell.classList.remove("highlight-text"); // クラスを削除
    }

    // ステータス内の赤色をリセット
    const statusCell = row.querySelector("td:nth-child(3)");
    if (statusCell) {
      statusCell.innerHTML = statusCell.innerHTML.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1");
    }
  });

  applyFilters();
}

// 検索モード変更時にフィルター適用
document.querySelectorAll('input[name="searchType"]').forEach(radio => {
  radio.addEventListener("change", applyFilters);
});

//画面の折りたたみ
// フィルターを開閉する関数
// フィルターのトグル機能（開閉表示を更新）
function toggleCollapsible(id) {
  const content = document.getElementById(id);
  const header = content.previousElementSibling; // フィルターヘッダー
  const toggleLabel = header.querySelector(".toggle-label"); // [開く] / [閉じる] のラベル

  // `getComputedStyle` を使って現在の `display` を取得
  const isVisible = window.getComputedStyle(content).display !== "none";

  // トグルの開閉
  content.style.display = isVisible ? "none" : "block";

  // ラベルの更新
  toggleLabel.textContent = isVisible ? "[開く]" : "[閉じる]";
}

document.addEventListener("DOMContentLoaded", function() {
  loadCards().then(() => {
    // 初回ロード時にはフィルタを適用しない
    isInitialLoad = true; // 初期表示フラグをONに設定
    applyFilters();
  });
  const filters = document.querySelectorAll("input[type='checkbox']");
  filters.forEach(filter => {
    filter.addEventListener('change', applyExtraFilters);
    filter.style.display = "block";
  });
  document.querySelectorAll('input[name="searchType"]').forEach(radio => {
    radio.addEventListener("change", applyFilters);
  });
});
