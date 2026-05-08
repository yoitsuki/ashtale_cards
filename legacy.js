let activeFilters = { name: "", status: [], rare: [], rank: [], category: [] };
let cardData = [];
let rowDataCache = []; // パフォーマンス最適化のためDOM要素とデータをキャッシュ
let searchType = "AND";


const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEG6xUCvYOj4r4u3x0aaI-aSFupJvC1eaQQzlcjPWoO8DLDtur28zGqOpHeTiNc-TR81s7nFZWSadA/pub?output=csv";
// 特殊フィルタ変換マップ
const specialFilters = {
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ与ダメ増": "対○○与ダメ増",
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ被ダメ減": "対○○被ダメ減",
  "攻撃%": "攻撃",
  "防御%": "防御",
  "HP%": "HP"
};

// 1. 初期ロード処理
document.addEventListener("DOMContentLoaded", async function() {
  setupEventListeners();
  loadUpdateHistory(); // 更新履歴の読み込み
  await loadCards(); // データの非同期読み込みと初回描画
  loadFiltersFromURL(); // URLから状態を復元
  applyFilters(); // フィルタ適用（ここで初めて表示が整う）
});

// イベントリスナーのセットアップ
function setupEventListeners() {
  document.querySelectorAll('input[name="searchType"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      searchType = e.target.value;
      applyFilters();
    });
  });

  const nameInput = document.getElementById("nameSearchInput");
  if (nameInput) {
    nameInput.addEventListener("input", (e) => {
      activeFilters.name = e.target.value.trim();
      applyFilters();
    });
  }

  // モーダル閉じる処理
  document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("imageModal").style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === document.getElementById("imageModal")) {
      document.getElementById("imageModal").style.display = "none";
    }
  });

  // 更新履歴外のクリックで閉じる
  document.addEventListener("click", (event) => {
    const history = document.getElementById("updateHistory");
    if (history && history.classList.contains("open") && !history.contains(event.target)) {
      history.classList.remove("open");
    }
  });
}

// 更新履歴を読み込んで表示
async function loadUpdateHistory() {
  const latestEl = document.getElementById("latestUpdateText");
  const listEl = document.getElementById("historyList");
  if (!latestEl || !listEl) return;

  try {
    const response = await fetch("update_history.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Network response was not ok");
    const history = await response.json();

    // 日付の降順でソート（文字列比較でYYYY/MM/DD形式を想定）
    const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

    if (sorted.length === 0) {
      latestEl.textContent = "--";
      return;
    }

    latestEl.textContent = sorted[0].date;

    // 展開時は最新＋過去2件の合計3件を表示（表面は日付のみで、内容は展開時に見える）
    const items = sorted.slice(0, 3);
    listEl.innerHTML = items.map(item =>
      `<div class="history-item">${item.date}　${item.content}</div>`
    ).join("");
  } catch (error) {
    console.error("更新履歴の取得に失敗しました:", error);
    latestEl.textContent = "--";
  }
}

// 更新履歴の展開/折りたたみ
function toggleHistory(event) {
  event.stopPropagation();
  const history = document.getElementById("updateHistory");
  if (history) history.classList.toggle("open");
}

// 2. カード用JSONデータを取得＆テーブル描画（DocumentFragment使用）
async function loadCards() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Network response was not ok");
    
    const csvText = await response.text();

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        // 固定の基本情報列（これ以外の列をステータス列として自動処理する）
        const baseColumns = ["id", "name", "rank", "rare", "category", "icon", "image", "special_status", "special_full_status"];

        cardData = results.data.map(row => {
          let status = [];
          let full_status = [];

          // 1. 武器や腕などの固有ステータス（「武器」「レイラR+7」など）がある場合の処理
          if (row.special_status) {
            status = row.special_status.split(/[、,]/).map(s => s.trim()).filter(s => s);
          }
          if (row.special_full_status) {
            full_status = row.special_full_status.split(/[、,]/).map(s => s.trim()).filter(s => s);
          }

          // 2. スプレッドシートの列をループし、数字が入っているステータスを自動抽出
          Object.keys(row).forEach(colName => {
            // 基本列ではなく、かつセルに何らかの文字（数字）が入っている場合
            if (!baseColumns.includes(colName) && row[colName] !== undefined && row[colName].trim() !== "") {
              let val = row[colName].trim();
              
              // 入力された数値の先頭に「+」も「-」も無ければ、自動で「+」を補完
              if (!val.startsWith('+') && !val.startsWith('-')) {
                val = '+' + val;
              }
              // 入力された数値の末尾に「%」が無ければ自動補完
              if (!val.endsWith('%')) {
                val = val + '%';
              }

              // 表示用のステータス名整形（例: "攻撃%" という列名なら出力時に "攻撃+19%" となるように % を削る）
              let displayName = colName.replace('%', '');

              status.push(colName);
              full_status.push(`${displayName}${val}`);
            }
          });

          return {
            id: parseInt(row.id, 10) || 0,
            name: row.name || "",
            rank: parseInt(row.rank, 10) || 0,
            rare: row.rare || "",
            category: row.category || "",
            icon: row.icon || "",
            image: row.image || "",
            status: status,
            full_status: full_status
          };
        });
        
        renderTable();
      }
    });
  } catch (error) {
    console.error("カードデータの取得に失敗しました:", error);
    const tbody = document.getElementById("table-body") || document.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">データの読み込みに失敗しました。</td></tr>`;
    }
  }
}

// テーブルを動的に生成（初回1回のみ実行）
function renderTable() {
  const tbody = document.getElementById("table-body");
  const fragment = document.createDocumentFragment();
  rowDataCache = [];

  cardData.forEach(card => {
    const row = document.createElement("tr");
    
    row.innerHTML = `
      <td><img src="${card.icon}" alt="${card.name}" class="icon-img"><br>${card.name}</td>
      <td>${card.category}</td>
      <td class="status-cell">${card.full_status.join("<br>")}</td>
    `;

    row.addEventListener("click", () => openModal(card.image));

    // 検索・フィルタリング用にデータをキャッシュ（DOMアクセスを減らす）
    rowDataCache.push({
      element: row,
      name: card.name,
      category: card.category,
      rare: card.rare || "",
      rank: String(card.rank || ""),
      statusList: card.status || [], // 生のステータス配列
      fullStatusHtml: card.full_status.join("<br>"), // 元のテキスト
      statusCell: row.querySelector(".status-cell")
    });

    fragment.appendChild(row);
  });

  tbody.appendChild(fragment);
}

// 3. フィルターの切り替えとURL同期
function toggleFilter(type, value, buttonElement) {
  const index = activeFilters[type].indexOf(value);

  if (index === -1) {
    activeFilters[type].push(value);
    buttonElement.classList.add("active");
  } else {
    activeFilters[type].splice(index, 1);
    buttonElement.classList.remove("active");
  }
  applyFilters();
}

function updateURL() {
  const params = new URLSearchParams();
  if (searchType !== "AND") params.set("type", searchType);
  if (activeFilters.name) params.set("name", activeFilters.name);
  if (activeFilters.category.length) params.set("category", activeFilters.category.join(","));
  if (activeFilters.rare.length) params.set("rare", activeFilters.rare.join(","));
  if (activeFilters.rank.length) params.set("rank", activeFilters.rank.join(","));
  if (activeFilters.status.length) params.set("status", activeFilters.status.join(","));

  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState(null, '', newUrl);
}

function loadFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.get("type")) {
    searchType = params.get("type");
    document.querySelector(`input[name="searchType"][value="${searchType}"]`).checked = true;
  }
  
  if (params.get("name")) {
    activeFilters.name = params.get("name");
    document.getElementById("nameSearchInput").value = activeFilters.name;
  }

  const loadArrayParam = (key) => {
    if (params.get(key)) {
      activeFilters[key] = params.get(key).split(",");
      // ボタンの見た目を同期
      activeFilters[key].forEach(val => {
        const btn = document.querySelector(`button[data-type="${key}"][data-value="${val}"]`);
        if (btn) btn.classList.add("active");
      });
    }
  };

  loadArrayParam("category");
  loadArrayParam("rare");
  loadArrayParam("rank");
  loadArrayParam("status");
}

// 4. フィルター適用ロジック
function applyFilters() {
  const hasStatusFilters = activeFilters.status.length > 0;
  const hasRareFilters = activeFilters.rare.length > 0;
  const hasRankFilters = activeFilters.rank.length > 0;
  const hasCategoryFilters = activeFilters.category.length > 0;
  const searchName = activeFilters.name.toLowerCase();

  // URLパラメータを更新
  updateURL();

  let visibleRowCount = 0;

  // statusの変換（例: "攻撃%" -> "攻撃"）
  const transformedActiveStatus = activeFilters.status.map(s => specialFilters[s] || s);

  rowDataCache.forEach(row => {
    // ステータスの変換
    let transformedCardStatus = row.statusList.map(s => specialFilters[s] || s);

    // テキスト検索判定
    let matchName = !searchName || row.name.toLowerCase().includes(searchName);
    
    // ステータス判定
    let matchStatus = !hasStatusFilters || (searchType === "AND" 
      ? transformedActiveStatus.every(filter => transformedCardStatus.includes(filter)) 
      : transformedActiveStatus.some(filter => transformedCardStatus.includes(filter)));

    let matchRare = !hasRareFilters || activeFilters.rare.includes(row.rare);
    let matchRank = !hasRankFilters || activeFilters.rank.includes(row.rank);
    let matchCategory = !hasCategoryFilters || activeFilters.category.includes(row.category);

    let isMatch = matchName && matchStatus && matchRare && matchRank && matchCategory;

    if (isMatch) {
      row.element.style.display = ""; // 表示
      visibleRowCount++;

      // ステータス強調（赤文字）処理
      if (hasStatusFilters) {
        let html = row.fullStatusHtml;
        transformedActiveStatus.forEach(filter => {
          const regex = new RegExp(`(^|<br>)(${filter}[-+]?\\d+%?)`, "gi");
          html = html.replace(regex, '$1<span class="highlight-text">$2</span>');
        });
        row.statusCell.innerHTML = html;
      } else {
        // フィルタがない場合は元のHTMLに戻す
        if (row.statusCell.innerHTML !== row.fullStatusHtml) {
          row.statusCell.innerHTML = row.fullStatusHtml;
        }
      }
    } else {
      row.element.style.display = "none"; // 非表示
    }
  });

  // 検索結果ゼロのメッセージ制御
  document.getElementById("no-data-msg").style.display = visibleRowCount === 0 ? "block" : "none";
}

// 5. フィルターリセット
function resetFilters() {
  activeFilters = { name: "", status: [], rare: [], rank: [], category: [] };
  
  // UIリセット
  document.getElementById("nameSearchInput").value = "";
  document.querySelectorAll(".filter-group button.active").forEach(button => {
    button.classList.remove("active");
  });
  
  // デフォルトはAND検索に戻す
  searchType = "AND";
  document.querySelector('input[name="searchType"][value="AND"]').checked = true;

  applyFilters();
}

// モーダル開閉
function openModal(imageSrc) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  modal.style.display = "block";
  modalImg.src = imageSrc;
}

function toggleCollapsible(id) {
  const content = document.getElementById(id);
  const header = content.previousElementSibling;
  const toggleLabel = header.querySelector(".toggle-label");
  const isVisible = window.getComputedStyle(content).display !== "none";

  content.style.display = isVisible ? "none" : "block";
  toggleLabel.textContent = isVisible ? "[開く]" : "[閉じる]";
}