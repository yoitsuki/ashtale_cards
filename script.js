let activeFilters = { name: "", status: [], rare: [], rank: [], category: [] };
let cardData = [];
let rowDataCache = []; // パフォーマンス最適化のためDOM要素とデータをキャッシュ
let searchType = "AND";
// ソート状態
//   sortMode: "default" | "rank" | "rare" | "name" | "status"
//   sortDir : "asc" | "desc"
//   sortTarget: status 名（sortMode === "status" の時のみ使用）
let sortMode = "default";
let sortDir = "asc";
let sortTarget = null;
let maxByStat = {};

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEG6xUCvYOj4r4u3x0aaI-aSFupJvC1eaQQzlcjPWoO8DLDtur28zGqOpHeTiNc-TR81s7nFZWSadA/pub?output=csv";
// 日英辞書 CSV（"ja, en" の2列を想定）
const DICTIONARY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEG6xUCvYOj4r4u3x0aaI-aSFupJvC1eaQQzlcjPWoO8DLDtur28zGqOpHeTiNc-TR81s7nFZWSadA/pub?gid=1896556978&single=true&output=csv";

// 検索条件の開閉状態を localStorage に保存するためのキー
const STORAGE_KEY_FILTER_OPEN = "ashtale.filterOpen";

// i18n: 表示言語と辞書
const STORAGE_KEY_LANG = "ashtale.lang";
let currentLang = "ja";       // "ja" | "en"
let sheetDict = {};           // スプレッドシートから読み込んだ辞書（ja → en）。ステータス名向け。

// UI 文言の JA→EN 対応表（コード内ハードコード）。ステータス名は sheetDict が優先される。
const UI_DICT = {
  // ヘッダ・概要
  "AshTale カード図鑑": "AshTale Card Index",
  "前のデザインに戻す": "Back to old design",
  "アッシュテイルの各カード(コラボカード、宝くじカード除く)を一覧にしております。ステータス検索等ご活用ください。各カードは、タップすると実際のカードデータを閲覧できます。":
    "A list of all AshTale cards (collab and lottery cards excluded). Use the status filters to find what you need. Tap any card to view its full data.",
  "5/25：試験的にデザインを変更しました。": "5/25: Trial redesign in progress.",
  "もし良ければ右のボタンから教えてください。": "Let me know what you think with the buttons on the right.",
  "ｲｲﾈ!": "Good!",
  "ｲﾏｲﾁ...": "Meh...",
  // 注意書き
  "必ず最初にお読みください": "Please read this first",
  "⚠️非公式攻略サイトです。そのため個人間でのトラブルなどがあっても対応はできません。また、その件に関して一切の責任は負えませんのでご了承下さい。":
    "⚠️ This is an unofficial fan site. I cannot mediate issues that arise between individual users, and accept no responsibility for any such matters.",
  "*『AshTale』『アッシュテイル -風の大陸-』は、X-LEGEND ENTERTAINMENT INC. の商標です。『AshTale』に関わる著作権その他一切の知的財産権は X-LEGEND ENTERTAINMENT INC. に属しており、このサイトは『AshTale』及び同社とは、一切関係がありません。":
    "*『AshTale』 and 『アッシュテイル -風の大陸-』 are trademarks of X-LEGEND ENTERTAINMENT INC. All copyrights and other intellectual property rights related to 『AshTale』 belong to X-LEGEND ENTERTAINMENT INC. This site has no affiliation with 『AshTale』 or the said company.",
  // 連絡
  "なにかありましたら": "If you have any feedback, please contact me via ",
  "マシュマロ": "Marshmallow",
  "まで。": ".",
  "最終更新日": "Last updated",
  // 検索条件
  "検索条件": "Filters",
  "カード名で検索": "Search by card name",
  "検索条件を表示": "Show filters",
  "検索条件を隠す": "Hide filters",
  "条件をリセット": "Reset filters",
  "カテゴリ": "Category",
  "レア度": "Rarity",
  "ランク": "Rank",
  "ステータス": "Status",
  // 結果ヘッダ・空表示・ローディング
  "件 ヒット": "hits",
  "読み込み中…": "Loading…",
  "該当するデータがありませんでした。": "No matching cards.",
  // ソート
  "手帳順": "Notebook order",
  "ランク高い順": "Rank (high → low)",
  "ランク低い順": "Rank (low → high)",
  "レア度（幻→金）": "Rarity (rare → common)",
  "レア度（金→幻）": "Rarity (common → rare)",
  "名前（あ→ん）": "Name (A → Z)",
  "名前（ん→あ）": "Name (Z → A)"
};

// 翻訳ヘルパ。EN モード時のみ辞書引きする。見つからなければ原文（JA）を返す。
function t(ja) {
  if (currentLang !== "en" || !ja) return ja;
  if (UI_DICT[ja]) return UI_DICT[ja];
  if (sheetDict[ja]) return sheetDict[ja];
  return ja;
}

// 👍 / 👎 ボタンの送信先（GAS Web App の URL を貼る。空のままだと送信は行われない）
// GAS 側の doPost(e) で `JSON.parse(e.postData.contents).vote` を読んでシートに append する想定。
const FEEDBACK_API_URL = "https://script.google.com/macros/s/AKfycbyii-MADeEvO_42fEP6vMPXjF2z1HhyCHDAUzp1w9jdYs2_K_HRopIDJIbKjh6-R7x69w/exec";
const STORAGE_KEY_FEEDBACK = "ashtale.feedbackVote";

// 特殊フィルタ変換マップ
const specialFilters = {
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ与ダメ増": "対○○与ダメ増",
  "対ファイ/ウィ/スカ/プリ/サモ/剣豪/プレ被ダメ減": "対○○被ダメ減",
  "攻撃%": "攻撃",
  "防御%": "防御",
  "HP%": "HP"
};
const aliasOf = (s) => specialFilters[s] || s;

// ステータス値の数値抽出（"+19%" -> 19, "-12" -> -12）
function numOf(val) {
  if (val == null) return 0;
  const m = String(val).match(/[-+]?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// 指定した alias（"攻撃" / "状態異常耐性" 等）のステータス値を card から取得。
// 該当ステータスが無ければ null。
function cardStatValue(card, alias) {
  for (let i = 0; i < card.status.length; i++) {
    if (aliasOf(card.status[i]) === alias) {
      const full = card.full_status[i] || "";
      const display = valFromFull(full, card.status[i]);
      return numOf(display || full);
    }
  }
  return null;
}

// "攻撃+19%" のような full_status 文字列から表示用の値部分（"+19%"）を抜く。
// CSV では "攻撃%" 列の表示値は先頭の % を取った "攻撃" + 値で組み立てられているため、
// name 末尾の % を落とした文字列を前置で剥がす。
function valFromFull(full, name) {
  if (!full) return "";
  const stripName =
    name && name.endsWith("%") ? name.slice(0, -1) : name || "";
  if (stripName && full.startsWith(stripName)) {
    return full.slice(stripName.length);
  }
  return full;
}

// レア度の表示順
const RARE_ORDER = { "幻": 0, "鋼": 1, "天": 2, "赤": 3, "金": 4 };

// ローマ数字（Ⅰ〜Ⅻ）。範囲外はそのまま数字で表示。
const ROMAN_NUMERALS = ["", "Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];
function toRoman(n) {
  return ROMAN_NUMERALS[n] || String(n);
}
// ソートのデフォルトオプション（カテゴリ・ランク・レア度・名前）。
// arrow は表示用、dir は内部処理用。
// 矢印は「リスト上から下へ自然に流れる向き」を ↓、逆順を ↑ で表す。
// 手帳順は登録順（先頭→末尾）の一方向なので ↓ のみ。
const DEFAULT_SORT_OPTIONS = [
  { mode: "default", dir: "asc",  arrow: "↓", label: "手帳順" },
  { mode: "rank",    dir: "desc", arrow: "↓", label: "ランク高い順" },
  { mode: "rank",    dir: "asc",  arrow: "↑", label: "ランク低い順" },
  { mode: "rare",    dir: "asc",  arrow: "↓", label: "レア度（幻→金）" },
  { mode: "rare",    dir: "desc", arrow: "↑", label: "レア度（金→幻）" },
  { mode: "name",    dir: "asc",  arrow: "↓", label: "名前（あ→ん）" },
  { mode: "name",    dir: "desc", arrow: "↑", label: "名前（ん→あ）" }
];

// 現在の状態（フィルタ選択状況）に応じてソートオプションを返す。
function getSortOptions() {
  if (activeFilters.status.length > 0) {
    const opts = [];
    activeFilters.status.forEach((s) => {
      opts.push({ mode: "status", dir: "desc", target: s, arrow: "↓", label: `${s}（高→低）` });
      opts.push({ mode: "status", dir: "asc",  target: s, arrow: "↑", label: `${s}（低→高）` });
    });
    return opts;
  }
  return DEFAULT_SORT_OPTIONS;
}

// ソートオプションのラベル翻訳。
// ステータス系は {status}（高→低 / 低→高） の構造なので名前部分だけ辞書引き。
function translateSortLabel(o) {
  if (currentLang !== "en") return o.label;
  if (o.mode === "status" && o.target) {
    const name = t(o.target);
    const suffix = o.dir === "desc" ? " (high → low)" : " (low → high)";
    return name + suffix;
  }
  return t(o.label);
}

function isCurrentSortOption(o) {
  if (o.mode !== sortMode) return false;
  if (o.dir !== sortDir) return false;
  if (o.mode === "status" && o.target !== sortTarget) return false;
  return true;
}

// ステータスフィルタの状態に応じてソートモードを揃える。
// ステータス選択中: 必ず "status" モードかつ target が選択中のいずれか。
// 非選択時: "status" モードは無効化して "default" に戻す。
function ensureValidSort() {
  const statuses = activeFilters.status;
  if (statuses.length > 0) {
    if (sortMode !== "status" || !statuses.includes(sortTarget)) {
      sortMode = "status";
      sortDir = "desc";
      sortTarget = statuses[0];
    }
  } else if (sortMode === "status") {
    sortMode = "default";
    sortDir = "asc";
    sortTarget = null;
  }
}

// 1. 初期ロード処理
document.addEventListener("DOMContentLoaded", async function () {
  // 言語の復元（既定 JA）
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    if (saved === "en" || saved === "ja") currentLang = saved;
  } catch (e) {}

  setupEventListeners();
  loadUpdateHistory();
  // 辞書とカードは並列で読み込む
  const dictPromise = loadDictionary();
  await loadCards();
  await dictPromise;
  loadFiltersFromURL();
  applyInitialFilterState();
  applyFilters();
  applyTranslations();
});

// イベントリスナーのセットアップ
function setupEventListeners() {
  // AND/OR セグメント
  document.querySelectorAll(".seg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      if (!mode || mode === searchType) return;
      searchType = mode;
      document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b === btn));
      applyFilters();
    });
  });

  // 名前検索
  const nameInput = document.getElementById("nameSearchInput");
  if (nameInput) {
    nameInput.addEventListener("input", (e) => {
      activeFilters.name = e.target.value.trim();
      applyFilters();
    });
  }

  // ソートメニュー開閉
  const sortBtn = document.getElementById("sortBtn");
  const sortMenu = document.getElementById("sortMenu");
  if (sortBtn && sortMenu) {
    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !sortMenu.hasAttribute("hidden");
      if (isOpen) {
        closeSortMenu();
      } else {
        openSortMenu();
      }
    });
    // メニュー外クリックで閉じる
    document.addEventListener("click", (e) => {
      if (sortMenu.hasAttribute("hidden")) return;
      if (!sortMenu.contains(e.target) && e.target !== sortBtn) {
        closeSortMenu();
      }
    });
    // Esc で閉じる
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sortMenu.hasAttribute("hidden")) closeSortMenu();
    });
  }

  // ステータス「もっと見る」
  const statusMoreBtn = document.getElementById("statusMoreBtn");
  const statusTags = document.getElementById("status-tags");
  if (statusMoreBtn && statusTags) {
    statusMoreBtn.addEventListener("click", () => {
      const open = statusTags.classList.toggle("open");
      statusMoreBtn.textContent = open ? "− 折りたたむ" : "+ もっと見る";
    });
  }

  // 検索条件トグル
  const filterToggle = document.getElementById("filterToggle");
  const filterArea = document.getElementById("filterArea");
  const filterToggleLabel = document.getElementById("filterToggleLabel");
  if (filterToggle && filterArea) {
    filterToggle.addEventListener("click", () => {
      const willOpen = !filterArea.classList.contains("open");
      animateFilterArea(filterArea, willOpen);
      filterToggle.classList.toggle("on", willOpen);
      filterToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (filterToggleLabel) {
        const jaLabel = willOpen ? "検索条件を隠す" : "検索条件を表示";
        filterToggleLabel.setAttribute("data-i18n", jaLabel);
        filterToggleLabel.textContent = t(jaLabel);
      }
      try {
        localStorage.setItem(STORAGE_KEY_FILTER_OPEN, willOpen ? "open" : "closed");
      } catch (e) { /* localStorage が使えない環境では無視 */ }
    });
  }

  setupFeedback();

  // 言語スイッチ（日本語 ／ EN）
  document.querySelectorAll(".lang-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.lang;
      if (!lang || lang === currentLang) return;
      currentLang = lang;
      try { localStorage.setItem(STORAGE_KEY_LANG, currentLang); } catch (e) {}
      applyTranslations();
      // カード行の stat-bar / レアチップ等を再描画
      applyFilters();
    });
  });

  // モーダル閉じる
  const modal = document.getElementById("imageModal");
  const closeBtn = modal ? modal.querySelector(".close") : null;
  if (closeBtn) closeBtn.addEventListener("click", () => closeModal());
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // 更新履歴外のクリックで閉じる
  document.addEventListener("click", (event) => {
    const history = document.getElementById("updateHistory");
    if (history && history.classList.contains("open") && !history.contains(event.target)) {
      history.classList.remove("open");
    }
  });
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  if (modal) modal.classList.remove("is-open");
}

// 日英辞書を読み込む（非同期・任意。失敗してもアプリは動く）。
async function loadDictionary() {
  try {
    const res = await fetch(DICTIONARY_CSV_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("Network response was not ok");
    const csv = await res.text();
    await new Promise((resolve) => {
      Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          sheetDict = {};
          results.data.forEach((row) => {
            const ja = (row.ja || "").trim();
            const en = (row.en || "").trim();
            if (ja && en) sheetDict[ja] = en;
          });
          resolve();
        }
      });
    });
  } catch (err) {
    console.warn("辞書の読み込みに失敗:", err);
  }
}

// HTML 上の data-i18n を一斉に翻訳。ボタンラベル、カードリスト、ソート系もリフレッシュ。
function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.placeholder = t(key);
  });

  // 言語スイッチの選択状態を更新
  document.querySelectorAll(".lang-opt").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.lang === currentLang);
  });

  // 「検索条件を表示／隠す」のラベルは状態依存なので再設定
  const filterArea = document.getElementById("filterArea");
  const filterToggleLabel = document.getElementById("filterToggleLabel");
  if (filterArea && filterToggleLabel) {
    const isOpen = filterArea.classList.contains("open");
    const jaLabel = isOpen ? "検索条件を隠す" : "検索条件を表示";
    filterToggleLabel.setAttribute("data-i18n", jaLabel);
    filterToggleLabel.textContent = t(jaLabel);
  }

  // ソートメニューが開いていれば再描画
  const sortMenu = document.getElementById("sortMenu");
  if (sortMenu && !sortMenu.hasAttribute("hidden")) renderSortMenu();
}

function openSortMenu() {
  const menu = document.getElementById("sortMenu");
  const btn = document.getElementById("sortBtn");
  if (!menu || !btn) return;
  renderSortMenu();
  menu.removeAttribute("hidden");
  btn.setAttribute("aria-expanded", "true");
}

function closeSortMenu() {
  const menu = document.getElementById("sortMenu");
  const btn = document.getElementById("sortBtn");
  if (menu) menu.setAttribute("hidden", "");
  if (btn) btn.setAttribute("aria-expanded", "false");
}

function renderSortMenu() {
  const menu = document.getElementById("sortMenu");
  if (!menu) return;
  const options = getSortOptions();
  const isStatusMode = activeFilters.status.length > 0;
  menu.classList.toggle("status-mode", isStatusMode);
  menu.innerHTML = options
    .map((o, i) => {
      const cls = isCurrentSortOption(o) ? "sort-option current" : "sort-option";
      const label = translateSortLabel(o);
      return `<button type="button" class="${cls}" role="menuitem" data-index="${i}">
        <span class="arrow">${o.arrow}</span><span>${escapeHtml(label)}</span>
      </button>`;
    })
    .join("");
  menu.querySelectorAll(".sort-option").forEach((btnEl) => {
    btnEl.addEventListener("click", () => {
      const idx = parseInt(btnEl.dataset.index, 10);
      const o = options[idx];
      if (!o) return;
      sortMode = o.mode;
      sortDir = o.dir;
      sortTarget = o.target || null;
      closeSortMenu();
      applyFilters();
    });
  });
}

// 検索条件エリアの開閉アニメーション。scrollHeight を測ることで実コンテンツ高さに合わせて遷移する。
function animateFilterArea(el, willOpen) {
  // 進行中のtransitionendハンドラがあれば外す
  if (el._faOnEnd) {
    el.removeEventListener("transitionend", el._faOnEnd);
    el._faOnEnd = null;
  }

  if (willOpen) {
    el.classList.add("open");
    // 一度 max-height を 0 に戻してからtarget値へ遷移させる
    el.style.maxHeight = "0px";
    // reflow を強制
    void el.offsetHeight;
    const target = el.scrollHeight;
    el.style.maxHeight = target + "px";

    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== "max-height") return;
      // 開きアニメ完了後は max-height を解除して、タグ選択等での内容変動に追従できるようにする
      el.style.maxHeight = "none";
      el.removeEventListener("transitionend", onEnd);
      el._faOnEnd = null;
    };
    el._faOnEnd = onEnd;
    el.addEventListener("transitionend", onEnd);
  } else {
    // 閉じる: 現在の高さを明示してから 0 に遷移
    const current = el.scrollHeight;
    el.style.maxHeight = current + "px";
    void el.offsetHeight;
    el.classList.remove("open");
    el.style.maxHeight = "0px";

    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== "max-height") return;
      el.removeEventListener("transitionend", onEnd);
      el._faOnEnd = null;
    };
    el._faOnEnd = onEnd;
    el.addEventListener("transitionend", onEnd);
  }
}

// 👍 / 👎 ボタンの初期化。FEEDBACK_API_URL が空のときは送信せずローカルにのみ記録する。
function setupFeedback() {
  const buttons = document.querySelectorAll(".feedback-btn");
  if (!buttons.length) return;

  // 既投票の状態を復元
  let already = null;
  try { already = localStorage.getItem(STORAGE_KEY_FEEDBACK); } catch (e) {}
  if (already) markVoted(already);

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const vote = btn.dataset.vote;
      if (!vote) return;

      // 二重投票防止
      let prev = null;
      try { prev = localStorage.getItem(STORAGE_KEY_FEEDBACK); } catch (e) {}
      if (prev) return;

      // 楽観的に投票済みに（連打防止）。送信失敗時のみ巻き戻す。
      markVoted(vote);
      try { localStorage.setItem(STORAGE_KEY_FEEDBACK, vote); } catch (e) {}

      if (!FEEDBACK_API_URL) return;

      // GAS Web App は 302 リダイレクトで googleusercontent.com に飛ばすため、
      // CORS モードだと cross-origin の preflight/redirect で失敗しやすい。
      // 投票はファイア・アンド・フォーゲットでよいので no-cors で送る。
      // body は application/x-www-form-urlencoded（CORS safelisted）で送り、
      // GAS 側では e.parameter.vote として受け取れる形にする。
      const form = new URLSearchParams();
      form.append("vote", vote);
      fetch(FEEDBACK_API_URL, {
        method: "POST",
        mode: "no-cors",
        body: form
      }).catch((err) => {
        console.error("フィードバック送信失敗:", err);
        // 失敗時は投票済み状態を解除
        try { localStorage.removeItem(STORAGE_KEY_FEEDBACK); } catch (e) {}
        document.querySelectorAll(".feedback-btn").forEach((b) => {
          b.classList.remove("voted");
          b.disabled = false;
        });
      });
    });
  });
}

function markVoted(vote) {
  document.querySelectorAll(".feedback-btn").forEach((b) => {
    b.classList.toggle("voted", b.dataset.vote === vote);
    b.disabled = true;
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

    const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

    if (sorted.length === 0) {
      latestEl.textContent = "--";
      return;
    }

    latestEl.textContent = sorted[0].date;
    const items = sorted.slice(0, 3);
    listEl.innerHTML = items
      .map((item) => `<div class="history-item">${item.date}　${item.content}</div>`)
      .join("");
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

// 2. カード用データを取得＆カード一覧描画
async function loadCards() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Network response was not ok");

    const csvText = await response.text();

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const baseColumns = ["id", "name", "rank", "rare", "category", "icon", "image", "special_status", "special_full_status"];

        cardData = results.data.map((row) => {
          let status = [];
          let full_status = [];

          if (row.special_status) {
            status = row.special_status.split(/[、,]/).map((s) => s.trim()).filter((s) => s);
          }
          if (row.special_full_status) {
            full_status = row.special_full_status.split(/[、,]/).map((s) => s.trim()).filter((s) => s);
          }

          Object.keys(row).forEach((colName) => {
            if (!baseColumns.includes(colName) && row[colName] !== undefined && row[colName].trim() !== "") {
              let val = row[colName].trim();
              if (!val.startsWith("+") && !val.startsWith("-")) val = "+" + val;
              if (!val.endsWith("%")) val = val + "%";
              const displayName = colName.replace("%", "");
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

        // ステータスごとの最大値（alias 後）を算出
        maxByStat = {};
        cardData.forEach((card) => {
          card.status.forEach((s, i) => {
            const a = aliasOf(s);
            const num = Math.abs(numOf(card.full_status[i]));
            if (!maxByStat[a] || num > maxByStat[a]) maxByStat[a] = num;
          });
        });

        const totalEl = document.getElementById("totalCount");
        if (totalEl) totalEl.textContent = String(cardData.length);

        renderCards();
      }
    });
  } catch (error) {
    console.error("カードデータの取得に失敗しました:", error);
    const loadingEl = document.getElementById("loading-msg");
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="face">ERROR</div>データの読み込みに失敗しました。`;
      loadingEl.style.display = "";
    }
  }
}

// カード一覧を生成（初回のみ DOM 作成、以降は表示制御）
function renderCards() {
  const container = document.getElementById("cards-container");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  rowDataCache = [];

  cardData.forEach((card, idx) => {
    const row = document.createElement("div");
    row.className = `cardrow r-${card.rare}`;

    const thumbInner = card.icon
      ? `<img src="${card.icon}" alt="${card.name}">`
      : "";

    const rankLabel = card.rank ? toRoman(card.rank) : "";
    row.innerHTML = `
      <div class="thumb-col">
        <div class="thumb">${thumbInner}</div>
        <div class="thumb-info">
          <span class="rare-chip r-${escapeHtml(card.rare)}"><span data-i18n="${escapeHtml(card.rare)}">${escapeHtml(t(card.rare))}</span><span class="rank-rom">${escapeHtml(rankLabel)}</span></span>
          <span class="cat-name" data-i18n="${escapeHtml(card.category)}">${escapeHtml(t(card.category))}</span>
        </div>
      </div>
      <div class="body">
        <div class="nm">${escapeHtml(card.name)}</div>
        <div class="stats"></div>
      </div>
    `;

    row.addEventListener("click", () => openModal(card.image));

    rowDataCache.push({
      element: row,
      card: card,
      origIndex: idx,
      name: card.name,
      category: card.category,
      rare: card.rare || "",
      rank: String(card.rank || ""),
      statusList: card.status || [],
      statsEl: row.querySelector(".stats")
    });

    fragment.appendChild(row);
  });

  container.appendChild(fragment);

  // 読み込み完了：読み込み中表示を消す
  const loadingEl = document.getElementById("loading-msg");
  if (loadingEl) loadingEl.style.display = "none";
}

// stat-bar の HTML を生成。
// ステータスフィルタが当たっている時のみ、一致したものを先頭に並び替える（その後ろは元の並び）。
function buildStatBars(card, transformedActiveStatus) {
  const targets = transformedActiveStatus;
  const items = card.status.map((name, i) => {
    const fullVal = card.full_status[i] || "";
    const display = valFromFull(fullVal, name);
    const alias = aliasOf(name);
    return {
      name,
      alias,
      display,
      n: numOf(display || fullVal),
      origIndex: i,
      hi: targets.includes(alias)
    };
  });

  if (targets.length > 0) {
    // 一致したものを「選択順」で先頭に。残りは元の並びを保つ。
    items.sort((a, b) => {
      if (a.hi !== b.hi) return a.hi ? -1 : 1;
      if (a.hi && b.hi) {
        const ai = targets.indexOf(a.alias);
        const bi = targets.indexOf(b.alias);
        if (ai !== bi) return ai - bi;
      }
      return a.origIndex - b.origIndex;
    });
  }

  return items
    .map((s) => {
      const max = maxByStat[s.alias] || 50;
      const pct = Math.min(100, Math.max(6, (Math.abs(s.n) / max) * 100));
      const valHtml = s.display ? `<div class="val">${escapeHtml(s.display)}</div>` : "";
      return `
        <div class="stat-bar ${s.hi ? "hi" : ""}">
          <div class="row">
            <div class="lbl">${escapeHtml(t(s.name))}</div>
            ${valHtml}
          </div>
          <div class="track"><div class="fill" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 3. フィルターの切り替えとURL同期
function toggleFilter(type, value, buttonElement) {
  const index = activeFilters[type].indexOf(value);
  if (index === -1) {
    activeFilters[type].push(value);
    buttonElement.classList.add("on");
  } else {
    activeFilters[type].splice(index, 1);
    buttonElement.classList.remove("on");
  }
  applyFilters();
}

function updateURL() {
  const params = new URLSearchParams();
  if (searchType !== "AND") params.set("type", searchType);
  // ソートは "default" 以外 / ascでない時のみクエリに書き込む。形式: "mode:dir[:target]"
  if (sortMode !== "default") {
    let v = `${sortMode}:${sortDir}`;
    if (sortMode === "status" && sortTarget) v += `:${sortTarget}`;
    params.set("sort", v);
  }
  if (activeFilters.name) params.set("name", activeFilters.name);
  if (activeFilters.category.length) params.set("category", activeFilters.category.join(","));
  if (activeFilters.rare.length) params.set("rare", activeFilters.rare.join(","));
  if (activeFilters.rank.length) params.set("rank", activeFilters.rank.join(","));
  if (activeFilters.status.length) params.set("status", activeFilters.status.join(","));

  const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
  window.history.replaceState(null, "", newUrl);
}

function loadFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("type")) {
    searchType = params.get("type");
    document.querySelectorAll(".seg button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-mode") === searchType);
    });
  }

  // ソート復元: "mode:dir[:target]"
  const sortParam = params.get("sort");
  if (sortParam) {
    const [m, d, ...rest] = sortParam.split(":");
    if (["default", "rank", "rare", "name", "status"].includes(m)) {
      sortMode = m;
      sortDir = d === "desc" ? "desc" : "asc";
      sortTarget = m === "status" && rest.length ? rest.join(":") : null;
    }
  }

  if (params.get("name")) {
    activeFilters.name = params.get("name");
    const nameInput = document.getElementById("nameSearchInput");
    if (nameInput) nameInput.value = activeFilters.name;
  }

  const loadArrayParam = (key) => {
    if (params.get(key)) {
      activeFilters[key] = params.get(key).split(",");
      activeFilters[key].forEach((val) => {
        const btn = document.querySelector(`button[data-type="${key}"][data-value="${CSS.escape(val)}"]`);
        if (btn) btn.classList.add("on");
      });
    }
  };

  loadArrayParam("category");
  loadArrayParam("rare");
  loadArrayParam("rank");
  loadArrayParam("status");
}

// 検索条件エリアの初期開閉状態を決める。
// 優先順位: URLパラメータでフィルタが入っている > localStorage の保存値 > デフォルト（開）。
function applyInitialFilterState() {
  const filterArea = document.getElementById("filterArea");
  const filterToggle = document.getElementById("filterToggle");
  const filterToggleLabel = document.getElementById("filterToggleLabel");
  if (!filterArea || !filterToggle) return;

  const totalActive =
    activeFilters.category.length +
    activeFilters.rare.length +
    activeFilters.rank.length +
    activeFilters.status.length;

  let shouldOpen;
  if (totalActive > 0) {
    shouldOpen = true;
  } else {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY_FILTER_OPEN); } catch (e) {}
    // 未設定（初回訪問）はデフォルトで開く。"closed" だけ閉じる。
    shouldOpen = saved !== "closed";
  }

  if (shouldOpen) {
    // 初期表示はアニメーションさせず即時に開いた状態にする
    filterArea.classList.add("open");
    filterArea.style.maxHeight = "none";
    filterToggle.classList.add("on");
    filterToggle.setAttribute("aria-expanded", "true");
    if (filterToggleLabel) {
      filterToggleLabel.setAttribute("data-i18n", "検索条件を隠す");
      filterToggleLabel.textContent = t("検索条件を隠す");
    }
  }
}

// 4. フィルター適用ロジック
function applyFilters() {
  // フィルタの状態に合わせてソートモードを正規化
  ensureValidSort();

  const hasStatusFilters = activeFilters.status.length > 0;
  const hasRareFilters = activeFilters.rare.length > 0;
  const hasRankFilters = activeFilters.rank.length > 0;
  const hasCategoryFilters = activeFilters.category.length > 0;
  const searchName = activeFilters.name.toLowerCase();

  updateURL();
  updateGroupCounts();

  const transformedActiveStatus = activeFilters.status.map((s) => aliasOf(s));

  // フィルタリング
  const visibleEntries = [];
  rowDataCache.forEach((row) => {
    const transformedCardStatus = row.statusList.map((s) => aliasOf(s));

    const matchName = !searchName || row.name.toLowerCase().includes(searchName);
    const matchStatus =
      !hasStatusFilters ||
      (searchType === "AND"
        ? transformedActiveStatus.every((f) => transformedCardStatus.includes(f))
        : transformedActiveStatus.some((f) => transformedCardStatus.includes(f)));
    const matchRare = !hasRareFilters || activeFilters.rare.includes(row.rare);
    const matchRank = !hasRankFilters || activeFilters.rank.includes(row.rank);
    const matchCategory = !hasCategoryFilters || activeFilters.category.includes(row.category);

    const isMatch = matchName && matchStatus && matchRare && matchRank && matchCategory;
    if (isMatch) {
      visibleEntries.push(row);
    } else {
      row.element.style.display = "none";
    }
  });

  // ソート
  const sign = sortDir === "asc" ? 1 : -1;
  const sortByMode = (a, b) => {
    const ra = a.card, rb = b.card;
    switch (sortMode) {
      case "rank":
        return (ra.rank - rb.rank) * sign || (a.origIndex - b.origIndex);
      case "rare":
        return ((RARE_ORDER[ra.rare] ?? 99) - (RARE_ORDER[rb.rare] ?? 99)) * sign
          || (rb.rank - ra.rank)
          || (a.origIndex - b.origIndex);
      case "name":
        return ra.name.localeCompare(rb.name, "ja") * sign;
      case "status": {
        const alias = aliasOf(sortTarget);
        const av = cardStatValue(ra, alias);
        const bv = cardStatValue(rb, alias);
        if (av === null && bv === null) return a.origIndex - b.origIndex;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av - bv) * sign || (a.origIndex - b.origIndex);
      }
      case "default":
      default:
        return a.origIndex - b.origIndex;
    }
  };

  visibleEntries.sort(sortByMode);

  // 並び順を DOM に反映＋ stat-bar 更新
  const container = document.getElementById("cards-container");
  if (container) {
    visibleEntries.forEach((row) => {
      row.element.style.display = "";
      row.statsEl.innerHTML = buildStatBars(row.card, transformedActiveStatus);
      container.appendChild(row.element); // 末尾追加で順序を整える
    });
  }

  // 件数 / empty 表示
  const hitEl = document.getElementById("hitCount");
  if (hitEl) hitEl.textContent = String(visibleEntries.length);
  const emptyEl = document.getElementById("no-data-msg");
  // データロード前は no-data を出さない（loading-msg がメッセージを担当）
  const dataReady = rowDataCache.length > 0;
  if (emptyEl) emptyEl.style.display = (dataReady && visibleEntries.length === 0) ? "block" : "none";

  renderActiveChips();
  updateFilterToggleBadge();
  updateSortButtonLabel();
}

// ステータスフィルタ中は並べ替えラベルを「○○順」に差し替え、ピンクで強調する
function updateSortButtonLabel() {
  const sortBtn = document.getElementById("sortBtn");
  if (!sortBtn) return;

  // 現在のソート状態に該当するオプションを取得
  const options = getSortOptions();
  const current = options.find(isCurrentSortOption);

  let arrow = "↓";
  let label = t("手帳順");
  if (current) {
    arrow = current.arrow;
    label = translateSortLabel(current);
  } else if (sortMode === "status" && sortTarget) {
    // フォールバック（フィルタ外のステータスが残っているケース）
    arrow = sortDir === "asc" ? "↑" : "↓";
    if (currentLang === "en") {
      label = t(sortTarget) + (sortDir === "asc" ? " (low → high)" : " (high → low)");
    } else {
      label = `${sortTarget}（${sortDir === "asc" ? "低→高" : "高→低"}）`;
    }
  }

  sortBtn.textContent = `${arrow} ${label}`;
  sortBtn.classList.toggle("status-sort", sortMode === "status");
}

function updateFilterToggleBadge() {
  const total =
    activeFilters.category.length +
    activeFilters.rare.length +
    activeFilters.rank.length +
    activeFilters.status.length;
  const badge = document.getElementById("filterCount");
  if (!badge) return;
  if (total > 0) {
    badge.textContent = String(total);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function updateGroupCounts() {
  const map = {
    "category": "gcount-category",
    "rare":     "gcount-rare",
    "rank":     "gcount-rank",
    "status":   "gcount-status"
  };
  Object.keys(map).forEach((key) => {
    const el = document.getElementById(map[key]);
    if (!el) return;
    const total = document.querySelectorAll(`button[data-type="${key}"]`).length;
    const active = activeFilters[key].length;
    el.textContent = `${active} / ${total}`;
  });
}

function renderActiveChips() {
  const container = document.getElementById("activeTags");
  if (!container) return;
  const chips = [
    ...activeFilters.category.map((v) => ({ k: "カテゴリ", v, translateV: true })),
    ...activeFilters.rare.map((v) => ({ k: "レア度", v, translateV: true })),
    ...activeFilters.rank.map((v) => ({ k: "ランク", v: "R" + v, translateV: false })),
    ...activeFilters.status.map((v) => ({ k: "ステータス", v, translateV: true }))
  ];
  container.innerHTML = chips
    .map((c) => `<span class="active-tag">${escapeHtml(t(c.k))}: ${escapeHtml(c.translateV ? t(c.v) : c.v)}</span>`)
    .join("");
}

// 5. フィルターリセット
function resetFilters() {
  activeFilters = { name: "", status: [], rare: [], rank: [], category: [] };

  const nameInput = document.getElementById("nameSearchInput");
  if (nameInput) nameInput.value = "";

  document.querySelectorAll(".tag.on").forEach((b) => b.classList.remove("on"));

  searchType = "AND";
  document.querySelectorAll(".seg button").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-mode") === "AND");
  });

  sortMode = "default";
  sortDir = "asc";
  sortTarget = null;

  applyFilters();
}

// モーダル開閉
function openModal(imageSrc) {
  if (!imageSrc) return;
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  if (!modal || !modalImg) return;

  // 画像の自然な横幅で判定する。AshTale のカード画像は 1枚 ≒ 1170px、2枚分 ≒ 2340px なので
  // 中間（1500px）を境界に、それより広い画像は「2枚分」とみなして横幅いっぱいに広げる。
  const applyRatio = () => {
    if (modalImg.naturalWidth) {
      modal.classList.toggle("landscape", modalImg.naturalWidth > 1500);
    }
  };

  modal.classList.remove("landscape");
  modalImg.onload = applyRatio;
  modalImg.src = imageSrc;
  // ブラウザがキャッシュ済みで onload が発火しないケースに対応
  if (modalImg.complete && modalImg.naturalWidth) applyRatio();
  modal.classList.add("is-open");
}
