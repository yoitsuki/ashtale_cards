const activeFilters = { status: [] };
let cardData = [];
let isInitialLoad = true; // 初期表示フラグ

// いいね数取得用
const sheetUrl = "https://script.google.com/macros/s/AKfycbyiXFK1JQuhpEWhZcqqjKRPlaTH9_way70o0ydYDT2ow4mWLST_6wJmHJtUb3BSgsoWxg/exec"; // Google Apps ScriptのデプロイURL
const pageId = "ash_tale_card"; // ページ固有のID（スプレッドシートのA列に設定）

// いいね数を取得
async function fetchLikes() {
  try {
      const requestParams = {
          method: "GET",
          headers: {
              "Accept": "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
          },
      };

      // fetch の結果を待つ
      const response = await fetch(sheetUrl + "?id=" + pageId, requestParams);

      // レスポンスが正常でない場合はエラーをスロー
      if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
      }

      // レスポンスの JSON データを取得
      const data = await response.json();

      // 取得したいいね数を表示
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
  const searchType = document.querySelector('input[name="searchType"]:checked').value;
  const hasFilters = activeFilters.status.length > 0; // フィルタが適用されているか

  // 特別処理が必要なフィルタ
  const specialFilters = {
    "攻撃%": "攻撃",
    "防御%": "防御",
    "HP%": "HP",
    "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ与ダメ増": "対○○与ダメ増",
    "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ被ダメ減": "対○○被ダメ減"
  };

  rows.forEach(row => {
    const status = row.getAttribute("data-status").split(",");
    const category = row.children[1].textContent.trim(); // カテゴリ取得
    let match = false;

    if (!hasFilters) {
      match = true;
    } else if (searchType === "AND") {
      match = activeFilters.status.every(filter => status.includes(filter));
    } else if (searchType === "OR") {
      match = activeFilters.status.some(filter => status.includes(filter));
    }

    row.style.display = match ? "" : "none";

    // ステータスセルの強調処理（初回ロード時はスキップ）
    const statusCell = row.querySelector("td:nth-child(3)");
    if (statusCell) {
      let html = statusCell.innerHTML;
      html = html.replace(/<span class="highlight-text">([^<]+)<\/span>/g, "$1"); // 既存ハイライトをリセット

      // **初回ロード時には赤字を表示しない**
      if (!isInitialLoad) {
        // フィルタまたはカテゴリに応じて強調表示
        if (category === "武器" || category === "腕") {
          // **武器・腕カテゴリなら全体を赤字**
          html = `<span class="highlight-text">${html}</span>`;
        } else {
          activeFilters.status.forEach(filter => {
            if (specialFilters[filter]) {
              const keyword = specialFilters[filter];
              const regex = new RegExp(`(^|<br>)(${keyword}[+\\d%]*)`, "gi");
              html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
            } else {
              const regex = new RegExp(`(^|<br>)(${filter}[+\\d%]*)`, "gi");
              html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
            }
          });
        }
      }

      statusCell.innerHTML = html;
    }
  });

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
  fetchLikes();
});

