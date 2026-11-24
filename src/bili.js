/* Aurora FM — bili.js
 * 哔哩哔哩电台（搜视频/搜博主/播客，仅播音频）、点播进度条、
 * 点播收藏夹 + 顶部置顶栏、自动连播、手动上下首。
 */

import { els, state, audio, escapeHtml, fmtDur, fmtPlay, fmtDate, fmtAgo, setStatus, registry } from "./core.js";
import { biliApi } from "./bili-api.js";

const hasDesktopApi = () => !!(window.aurora && window.aurora.biliSearch);
const apiSearch = (...args) =>
  hasDesktopApi() ? window.aurora.biliSearch(...args) : biliApi.search(...args);
const apiPodcastSearch = (kw) =>
  window.aurora && window.aurora.podcastSearch
    ? window.aurora.podcastSearch(kw)
    : biliApi.podcastSearch(kw);
const apiPodcastEpisodes = (...args) =>
  window.aurora && window.aurora.podcastEpisodes
    ? window.aurora.podcastEpisodes(...args)
    : biliApi.podcastEpisodes(...args);
const apiResolve = (...args) =>
  window.aurora && window.aurora.biliResolve
    ? window.aurora.biliResolve(...args)
    : biliApi.resolve(...args);

const bili = { keyword: "", page: 1, items: [], loading: false, current: null, mode: "video", authors: [], curAuthor: null, sort: "totalrank", auto: true, podResults: [], podEps: [], podView: "search" };
const PAGE_COUNT = 20;

function openBiliPanel() {
  els.biliPanel.classList.remove("hidden");
  els.biliSearchInput.focus();
  if (!bili.keyword && !bili.items.length && !bili.podResults.length && !bili.authors.length && !bili.loading) {
    biliSearchCategory(null, true);
  }
}
els.biliPanelClose.addEventListener("click", () => els.biliPanel.classList.add("hidden"));
els.biliSearchBtn.addEventListener("click", () => biliSearch(true));
els.biliSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") biliSearch(true);
});

const BILI_PLACEHOLDER = {
  video: "输入关键词搜索 B 站视频，如：周杰伦、相声、白噪音...",
  author: "输入博主（UP主）名字，如：周杰伦、罗翔说刑法...",
  podcast: "输入关键词搜索播客节目，如：故事FM、大内密谈、科技早知道...",
};
const BILI_TITLES = {
  video: "📺 B站电台 · 搜视频听音频",
  author: "📺 B站电台 · 搜博主听音频",
  podcast: "🎙 播客电台 · 搜节目听音频",
};
function setBiliMode(mode) {
  bili.mode = mode;
  els.biliModeVideo.classList.toggle("on", mode === "video");
  els.biliModeAuthor.classList.toggle("on", mode === "author");
  els.biliModePod.classList.toggle("on", mode === "podcast");
  els.biliSearchInput.placeholder = BILI_PLACEHOLDER[mode];
  els.biliPanelTitle.textContent = BILI_TITLES[mode];
  els.biliAuthors.classList.add("hidden");
  const isPod = mode === "podcast";
  els.biliSortDefault.classList.toggle("hidden", isPod);
  els.biliSortNew.classList.toggle("hidden", isPod);
  if (isPod) renderBiliPodcast();
}
els.biliModeVideo.addEventListener("click", () => setBiliMode("video"));
els.biliModeAuthor.addEventListener("click", () => setBiliMode("author"));
els.biliModePod.addEventListener("click", () => setBiliMode("podcast"));

/* ---------- 分类推荐子标签栏 ---------- */
const BILI_CATS = {
  tech:      { kw: ["科技早知道", "极客鲜知", "硬件科普", "人工智能科普", "数码测评", "前沿科技"], pod: ["科技早知道", "硅谷101", "What's Next｜科技早知道", "半拿铁"] },
  news:      { kw: ["新闻今日谈", "时事热点解读", "国际新闻分析", "每日新闻", "深度报道"], pod: ["新闻迷你谈", "声动早咖啡", "商业就是这样", "凹凸电波"] },
  philosophy: { kw: ["哲学导论", "王德峰哲学", "西方哲学史", "人生哲学课", "刘擎", "庄子漫谈"], pod: ["翻转电台", "随机波动", "不合时宜", "独树一帜"] },
  fun:       { kw: ["沙雕日常", "搞笑日常", "爆笑脱口秀", "趣味冷知识", "神奇脑洞", "名场面"], pod: ["津津乐道", "大内密谈", "日谈公园", "不可以了解吗"] },
  comedy:    { kw: ["郭德纲相声", "德云社相声", "赵本山小品", "相声大会", "经典小品合集", "单口相声"], pod: ["相声大会", "德云社", "开心麻花", "喜剧广播"] },
  history:   { kw: ["中国通史", "世界历史", "明朝那些事儿", "历史冷知识", "三国志讲", "一战二战"], pod: ["东腔西调", "边角聊", "忽左忽右", "历史投影"] },
  music:     { kw: ["周杰伦", "经典老歌", "轻音乐纯音乐", "吉他指弹", "粤语金曲", "民谣合集"], pod: ["不在场", "声音图书馆", "坏蛋调频", "民间百科"] },
  sleep:     { kw: ["白噪音", "雨声助眠", "asmr助眠", "篝火声", "海浪声", "自然音"], pod: ["睡前故事", "晚安电台", "冥想引导", "漫谈睡眠"] },
  humanity:  { kw: ["文学名著朗读", "余华", "莫言", "散文朗诵", "诗经楚辞", "人间失格"], pod: ["跳岛FM", "剩女向前冲", "文化有限", "忽而立秋"] },
};
let biliCurCat = null;
function pickCatKeyword(catKey, isPod) {
  const pool = (BILI_CATS[catKey] || {})[isPod ? "pod" : "kw"] || [];
  if (!pool.length) return "";
  return pool[Math.floor(Math.random() * pool.length)];
}
function markCatChip(catKey) {
  biliCurCat = catKey;
  els.biliCatChips.querySelectorAll(".bili-cat").forEach((c) => c.classList.toggle("on", c.dataset.cat === catKey));
}
async function biliSearchCategory(catKey, auto) {
  const key = catKey || biliCurCat || (bili.mode === "podcast" ? "tech" : "tech");
  const kw = pickCatKeyword(key, bili.mode === "podcast");
  if (!kw) return;
  markCatChip(key);
  els.biliSearchInput.value = kw;
  await biliSearch(true);
}
els.biliCatChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".bili-cat");
  if (!chip) return;
  if (chip.dataset.cat.startsWith("custom-")) { customCatClick(+chip.dataset.cat.slice(7)); return; }
  biliSearchCategory(chip.dataset.cat);
});
els.biliCatChips.addEventListener("contextmenu", (e) => {
  const chip = e.target.closest(".bili-cat-custom");
  if (!chip) return;
  e.preventDefault();
  const i = +chip.dataset.cat.slice(7);
  if (!customCats[i]) return;
  setStatus(`已删除快捷分类「${customCats[i]}」`);
  customCats[i] = null;
  saveCustomCats();
  renderCustomCats();
});

/* ---- 自定义快捷分类：3 个槽位，localStorage 持久化 ---- */
const CUSTOM_CAT_COUNT = 3;
const BUILTIN_CAT_KEYS = Array.from(document.querySelectorAll("#biliCatChips .bili-cat:not(.bili-cat-custom)")).map((el) => el.dataset.cat);
document.querySelectorAll("#biliCatChips .bili-cat:not(.bili-cat-custom)").forEach((el) => (el.draggable = true));
let customCats;
try { customCats = JSON.parse(localStorage.getItem("aurora_bili_custom") || "null") || []; }
catch (_) { customCats = []; }
while (customCats.length < CUSTOM_CAT_COUNT) customCats.push(null);
if (customCats.length > CUSTOM_CAT_COUNT) customCats.length = CUSTOM_CAT_COUNT;
function saveCustomCats() { localStorage.setItem("aurora_bili_custom", JSON.stringify(customCats)); }

const CAT_ORDER_KEY = "aurora_bili_cat_order";
let catOrder;
try {
  const savedOrder = JSON.parse(localStorage.getItem(CAT_ORDER_KEY) || "null");
  catOrder = Array.isArray(savedOrder)
    ? savedOrder.filter((k) => BUILTIN_CAT_KEYS.includes(k) || /^custom-\d+$/.test(k))
    : [];
} catch (_) { catOrder = []; }
BUILTIN_CAT_KEYS.forEach((k) => { if (!catOrder.includes(k)) catOrder.push(k); });
for (let i = 0; i < CUSTOM_CAT_COUNT; i++) { const k = "custom-" + i; if (!catOrder.includes(k)) catOrder.push(k); }
catOrder = catOrder.filter((k) => BUILTIN_CAT_KEYS.includes(k) || (/^custom-\d+$/.test(k) && +k.slice(7) < CUSTOM_CAT_COUNT));
function saveCatOrder() { localStorage.setItem(CAT_ORDER_KEY, JSON.stringify(catOrder)); }

function makeCustomChip(i) {
  const b = document.createElement("button");
  b.className = "bili-cat bili-cat-custom";
  b.draggable = true;
  b.dataset.cat = "custom-" + i;
  const kw = customCats[i];
  if (kw) {
    b.textContent = "⭐ " + (kw.length > 6 ? kw.slice(0, 6) + "…" : kw);
    b.title = `${kw}\n单击：立即搜索 · 右键：删除`;
  } else {
    b.textContent = "＋ 添加";
    b.title = "把搜索框里的内容添加为快捷分类\n已添加的槽：单击立即搜索 · 右键删除";
    b.classList.add("empty");
  }
  return b;
}
function layoutCatChips() {
  const nodes = {};
  els.biliCatChips.querySelectorAll(".bili-cat").forEach((el) => (nodes[el.dataset.cat] = el));
  els.biliCatChips.querySelectorAll(".bili-cat").forEach((el) => el.remove());
  const frag = document.createDocumentFragment();
  for (const key of catOrder) {
    if (key.startsWith("custom-")) frag.appendChild(makeCustomChip(+key.slice(7)));
    else if (nodes[key]) frag.appendChild(nodes[key]);
  }
  els.biliCatChips.appendChild(frag);
}
function renderCustomCats() { layoutCatChips(); }

function customCatClick(i) {
  const saved = customCats[i];
  if (saved) {
    markCatChip("custom-" + i);
    els.biliSearchInput.value = saved;
    biliSearch(true);
    return;
  }
  const kw = els.biliSearchInput.value.trim();
  if (!kw) {
    setStatus("先在搜索框输入关键词，再点「＋ 添加」保存", "error");
    els.biliSearchInput.focus();
    return;
  }
  customCats[i] = kw;
  saveCustomCats();
  renderCustomCats();
  markCatChip("custom-" + i);
  setStatus(`已添加快捷分类「${kw}」`, "ok");
  biliSearch(true);
}

/* ---- 分类拖动排序 ---- */
let dragCatKey = null;
els.biliCatChips.addEventListener("dragstart", (e) => {
  const chip = e.target.closest(".bili-cat");
  if (!chip) return;
  dragCatKey = chip.dataset.cat;
  requestAnimationFrame(() => chip.classList.add("dragging-chip"));
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", dragCatKey); } catch (_) { /* ignore */ }
});
els.biliCatChips.addEventListener("dragover", (e) => {
  if (!dragCatKey) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const chip = e.target.closest(".bili-cat");
  els.biliCatChips.querySelectorAll(".bili-cat").forEach((c) => c.classList.toggle("drag-over", !!chip && c === chip && chip.dataset.cat !== dragCatKey));
});
els.biliCatChips.addEventListener("drop", (e) => {
  if (!dragCatKey) return;
  e.preventDefault();
  const chip = e.target.closest(".bili-cat");
  const key = dragCatKey;
  const from = catOrder.indexOf(key);
  els.biliCatChips.querySelectorAll(".drag-over").forEach((c) => c.classList.remove("drag-over"));
  dragCatKey = null;
  if (!chip || from < 0) return;
  const targetKey = chip.dataset.cat;
  if (targetKey === key) return;
  catOrder.splice(from, 1);
  const to = catOrder.indexOf(targetKey);
  if (to < 0) { layoutCatChips(); return; }
  catOrder.splice(to + (from > to ? 0 : 1), 0, key);
  saveCatOrder();
  layoutCatChips();
  setStatus("分类顺序已保存，下次打开保持此排列", "ok");
});
els.biliCatChips.addEventListener("dragend", () => {
  dragCatKey = null;
  els.biliCatChips.querySelectorAll(".dragging-chip,.drag-over").forEach((c) => c.classList.remove("dragging-chip", "drag-over"));
});
renderCustomCats();

/* ---- 搜索历史 ---- */
const HIST_KEY = "aurora_bili_history";
let biliHistory;
try { biliHistory = JSON.parse(localStorage.getItem(HIST_KEY) || "null") || []; } catch (_) { biliHistory = []; }
biliHistory = biliHistory.filter((k) => typeof k === "string").slice(0, 5);
function saveBiliHistory() { localStorage.setItem(HIST_KEY, JSON.stringify(biliHistory)); }
function pushBiliHistory(kw) {
  if (!kw) return;
  biliHistory = [kw, ...biliHistory.filter((k) => k !== kw)].slice(0, 5);
  saveBiliHistory();
  renderBiliHistory();
}
function renderBiliHistory() {
  els.biliHistRow.classList.toggle("hidden", !biliHistory.length);
  els.biliHistChips.innerHTML = biliHistory
    .map((k) => `<button class="bili-hist-chip" data-kw="${escapeHtml(k)}" title="点击搜索「${escapeHtml(k)}">${escapeHtml(k)}</button>`)
    .join("");
}
els.biliHistChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".bili-hist-chip");
  if (!chip) return;
  els.biliSearchInput.value = chip.dataset.kw;
  markCatChip(null);
  biliSearch(true);
});
els.biliHistClear.addEventListener("click", () => {
  biliHistory = [];
  saveBiliHistory();
  renderBiliHistory();
  setStatus("已清空搜索历史");
});
renderBiliHistory();

function setBiliSort(ord) {
  bili.sort = ord;
  els.biliSortDefault.classList.toggle("on", ord === "totalrank");
  els.biliSortNew.classList.toggle("on", ord === "pubdate");
  if (bili.keyword) biliSearch(true);
}
els.biliSortDefault.addEventListener("click", () => setBiliSort("totalrank"));
els.biliSortNew.addEventListener("click", () => setBiliSort("pubdate"));

els.biliAutoBtn.addEventListener("click", () => {
  bili.auto = !bili.auto;
  els.biliAutoBtn.classList.toggle("on", bili.auto);
  setStatus(bili.auto ? "已开启自动连播：播完自动播下一个节目" : "已关闭自动连播");
});

async function biliSearch(reset) {
  const kw = els.biliSearchInput.value.trim();
  if (!kw) { setStatus("请输入搜索关键词", "error"); return; }
  if (reset) pushBiliHistory(kw);
  if (!hasDesktopApi() && !biliApi.available) {
    setStatus("当前环境不支持搜索", "error");
    return;
  }
  if (bili.mode === "podcast") {
    if (!(window.aurora && window.aurora.podcastSearch) && !biliApi.available) {
      setStatus("当前环境不支持播客搜索", "error");
      return;
    }
    if (bili.loading) return;
    bili.loading = true;
    renderBiliLoading();
    try {
      const r = await apiPodcastSearch(kw);
      bili.podResults = r.items || [];
      bili.podView = "search";
      renderBiliPodcast();
    } catch (e) {
      els.biliResults.innerHTML = `<div class="bili-empty">播客搜索失败：${escapeHtml(e.message || "未知错误")}</div>`;
    } finally {
      bili.loading = false;
    }
    return;
  }
  if (reset) { bili.keyword = kw; bili.page = 1; bili.items = []; }
  if (bili.loading) return;
  bili.loading = true;
  renderBiliLoading();
  try {
    const r = await apiSearch(bili.keyword, bili.page, bili.mode, bili.sort);
    if (r.mode === "author") {
      bili.authors = r.authors || [];
      bili.curAuthor = bili.authors.length ? bili.authors[0].author : null;
      renderBiliAuthorMode();
    } else {
      bili.items = bili.page === 1 ? r.items : bili.items.concat(r.items);
      bili.page++;
      renderBiliResults();
    }
  } catch (e) {
    els.biliResults.innerHTML = `<div class="bili-empty">搜索失败：${escapeHtml(e.message || "未知错误")}</div>`;
    els.biliAuthors.classList.add("hidden");
  } finally {
    bili.loading = false;
  }
}

function renderBiliLoading() {
  els.biliResults.innerHTML = Array(5).fill('<div class="skeleton" style="height:64px"></div>').join("");
}

function biliItemHtml(it, i) {
  return `
    <div class="bili-item" data-i="${i}" title="${escapeHtml(it.title)}">
      <img class="bili-thumb" src="${escapeHtml(it.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div class="bili-item-info">
        <div class="bili-item-title">${escapeHtml(it.title)}</div>
        <div class="bili-item-sub">${escapeHtml(it.author)} · ${escapeHtml(it.duration)} · ▶ ${fmtPlay(it.play)}${it.pages > 1 ? " · " + it.pages + "P" : ""}${bili.sort === "pubdate" && it.pubdate ? " · 📅 " + fmtDate(it.pubdate) : ""}</div>
      </div>
      ${vodFavStarHtml("bili", i, it)}
      <div class="bili-item-play">♪ 播放</div>
    </div>`;
}

function renderBiliResults() {
  if (!bili.items.length) {
    els.biliResults.innerHTML = '<div class="bili-empty">没有找到相关视频，换个关键词试试</div>';
    return;
  }
  const html = bili.items.map((it, i) => biliItemHtml(it, i)).join("");
  const more = bili.items.length >= PAGE_COUNT ? '<button id="biliMoreBtn" class="btn-more" style="margin:10px auto">加载更多</button>' : "";
  els.biliResults.innerHTML = html + more;
  els.biliResults.querySelector("#biliMoreBtn")?.addEventListener("click", () => biliSearch(false));
}

function renderBiliAuthorMode() {
  if (!bili.authors.length) {
    els.biliAuthors.classList.add("hidden");
    els.biliResults.innerHTML = '<div class="bili-empty">没有找到相关博主，换个名字试试（也可切换「搜视频」）</div>';
    return;
  }
  els.biliAuthors.classList.remove("hidden");
  els.biliAuthors.innerHTML = bili.authors
    .map((a) => `<button class="bili-author-pill${a.author === bili.curAuthor ? " on" : ""}" data-author="${escapeHtml(a.author)}">${escapeHtml(a.author)}<i>${a.count}</i></button>`)
    .join("");
  const cur = bili.authors.find((a) => a.author === bili.curAuthor);
  els.biliResults.innerHTML = cur && cur.items.length
    ? cur.items.map((it, i) => biliItemHtml(it, i)).join("")
    : '<div class="bili-empty">该博主暂无可播放的视频</div>';
}

els.biliAuthors.addEventListener("click", (e) => {
  const pill = e.target.closest(".bili-author-pill");
  if (!pill) return;
  bili.curAuthor = pill.dataset.author;
  renderBiliAuthorMode();
});

function podSearchHtml(p, i) {
  return `
    <div class="bili-item" data-kind="pod" data-i="${i}" title="${escapeHtml(p.title)}">
      <img class="bili-thumb bili-thumb-sq" src="${escapeHtml(p.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div class="bili-item-info">
        <div class="bili-item-title">${escapeHtml(p.title)}</div>
        <div class="bili-item-sub">${escapeHtml(p.artist)}${p.genre ? " · " + escapeHtml(p.genre) : ""}${p.count ? " · " + p.count + " 集" : ""}</div>
      </div>
      ${vodFavStarHtml("pod", i, p)}
      <div class="bili-item-play">♪ 单集</div>
    </div>`;
}
function podEpHtml(ep, i) {
  return `
    <div class="bili-item" data-kind="pod-ep" data-i="${i}" title="${escapeHtml(ep.title)}">
      <img class="bili-thumb" src="${escapeHtml(ep.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      <div class="bili-item-info">
        <div class="bili-item-title">${escapeHtml(ep.title)}</div>
        <div class="bili-item-sub">${ep.duration ? fmtDur(ep.duration) + " · " : ""}${ep.pubdate ? "📅 " + fmtDate(ep.pubdate) : ""}</div>
      </div>
      ${vodFavStarHtml("ep", i, ep)}
      <div class="bili-item-play">♪ 播放</div>
    </div>`;
}
function renderBiliPodcast() {
  if (bili.podView === "episodes" && bili.podEps.length) {
    const back = '<button class="pod-back btn-more" style="margin:6px auto 2px">← 返回播客列表</button>';
    els.biliResults.innerHTML = back + bili.podEps.map((ep, i) => podEpHtml(ep, i)).join("");
    return;
  }
  els.biliAuthors.classList.add("hidden");
  if (!bili.podResults.length) {
    els.biliResults.innerHTML = '<div class="bili-empty">没有找到相关播客，换个关键词试试</div>';
    return;
  }
  els.biliResults.innerHTML = bili.podResults.map((p, i) => podSearchHtml(p, i)).join("");
}

/* ---------- 点播收藏夹 + 顶部置顶栏 ---------- */
const VOD_PIN_MAX = 5;

function vodKeyOf(type, item) {
  if (type === "bili") return "bili-" + (item.bvid || item.title);
  if (type === "ep") return "ep-" + (item.enclosure || item.title);
  return "pod-" + (item.podcastId || item.feedUrl || item.title);
}
function vodListByType(type) {
  if (type === "pod") return bili.podResults;
  if (type === "ep") return bili.podEps;
  return bili.mode === "author"
    ? ((bili.authors.find((a) => a.author === bili.curAuthor) || {}).items || [])
    : bili.items;
}
function vodIsFaved(key) { return state.vodFavs.some((f) => f.key === key); }

function vodFavStarHtml(type, i, item) {
  const key = vodKeyOf(type, item);
  const on = vodIsFaved(key);
  return `<button class="vod-fav-star${on ? " on" : ""}" data-vodtype="${type}" data-vodi="${i}" data-key="${escapeHtml(key)}" title="${on ? "取消收藏" : "收藏到点播收藏夹"}">${on ? "★" : "☆"}</button>`;
}
function makeVodFav(type, item, key) {
  return {
    key: key || vodKeyOf(type, item),
    type,
    title: item.title || "未命名",
    sub: type === "bili" ? (item.author || "哔哩哔哩") : (item.artist || item.podTitle || "播客"),
    pic: item.pic || "",
    page: item.page || 1,
    data: Object.assign({}, item),
    ts: Date.now(),
  };
}
function saveVodFavs() {
  try {
    localStorage.setItem("aurora_vod_fav", JSON.stringify(state.vodFavs));
    localStorage.setItem("aurora_vod_pin", JSON.stringify(state.vodPins));
  } catch (_) { /* ignore */ }
}
function refreshVodStars() {
  document.querySelectorAll(".vod-fav-star").forEach((btn) => {
    const on = vodIsFaved(btn.dataset.key);
    btn.classList.toggle("on", on);
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "取消收藏" : "收藏到点播收藏夹";
  });
}
function renderVodPins() {
  const byKey = new Map(state.vodFavs.map((f) => [f.key, f]));
  state.vodPins = state.vodPins.filter((k) => byKey.has(k)).slice(0, VOD_PIN_MAX);
  let html = "";
  for (let i = 0; i < VOD_PIN_MAX; i++) {
    const f = byKey.get(state.vodPins[i]);
    if (f) {
      const ico = f.type === "bili" ? "📺" : f.type === "pod" ? "🎙" : "🎧";
      html += `<div class="vod-slot" data-key="${escapeHtml(f.key)}" title="${escapeHtml(f.title)}（点击播放 · 右键取消置顶）">
        ${f.pic ? `<img src="${escapeHtml(f.pic)}" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : `<span class="vs-ico">${ico}</span>`}
        <span>${escapeHtml(f.title)}</span>
        <button class="vod-slot-x" data-unpin="${escapeHtml(f.key)}" title="取消置顶">×</button>
      </div>`;
    } else {
      html += `<div class="vod-slot empty" data-empty="1" title="在「点播收藏」里点 📌 添加置顶">+</div>`;
    }
  }
  els.vodPinSlots.innerHTML = html;
  els.vodFavCount.textContent = state.vodFavs.length;
  saveVodFavs();
}
function renderVodFavPanel() {
  if (!state.vodFavs.length) {
    els.vodFavList.innerHTML = '<div class="history-empty">还没有收藏，去 B站 / 播客搜索结果点 ☆ 收藏吧 ⭐<br>收藏后点 📌 可放到顶部置顶栏（共 5 个位置）</div>';
    return;
  }
  els.vodFavList.innerHTML = state.vodFavs.map((f) => {
    const label = f.type === "bili" ? "📺 B站" : f.type === "pod" ? "🎙 播客" : "🎧 单集";
    const pinned = state.vodPins.includes(f.key);
    return `
      <div class="history-item" data-key="${escapeHtml(f.key)}" title="${escapeHtml(f.title)}">
        ${f.pic ? `<img class="history-thumb" src="${escapeHtml(f.pic)}" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<div class="history-thumb"></div>'}
        <div class="history-info">
          <div class="history-name">${escapeHtml(f.title)}</div>
          <div class="history-sub"><span class="vod-fav-badge${f.type === "bili" ? "" : " pod"}">${label}</span> ${escapeHtml(f.sub || "")}</div>
        </div>
        <div class="vod-fav-ops">
          <button data-act="pin" class="${pinned ? "on" : ""}" title="${pinned ? "取消置顶" : "置顶到顶部栏"}">📌</button>
          <button data-act="del" title="删除收藏">🗑</button>
        </div>
      </div>`;
  }).join("");
}
function toggleVodFavByItem(type, item, key) {
  key = key || vodKeyOf(type, item);
  const idx = state.vodFavs.findIndex((f) => f.key === key);
  if (idx >= 0) {
    state.vodFavs.splice(idx, 1);
    state.vodPins = state.vodPins.filter((k) => k !== key);
    setStatus("已取消收藏");
  } else {
    state.vodFavs.unshift(makeVodFav(type, item, key));
    setStatus("已收藏 ⭐ 可在「点播收藏」里 📌 置顶", "ok");
  }
  renderVodPins();
  refreshVodStars();
  if (!els.vodFavPanel.classList.contains("hidden")) renderVodFavPanel();
  updateCurFavBtn();
}
function toggleVodPin(key) {
  const i = state.vodPins.indexOf(key);
  if (i >= 0) state.vodPins.splice(i, 1);
  else {
    if (state.vodPins.length >= VOD_PIN_MAX) { setStatus(`置顶栏只有 ${VOD_PIN_MAX} 个位置，请先取消一个 📌`, "error"); return; }
    state.vodPins.push(key);
  }
  renderVodPins();
  renderVodFavPanel();
  setStatus(i >= 0 ? "已取消置顶" : "已置顶到顶部栏 📌", "ok");
}
function removeVodFav(key) {
  state.vodFavs = state.vodFavs.filter((f) => f.key !== key);
  state.vodPins = state.vodPins.filter((k) => k !== key);
  renderVodPins();
  renderVodFavPanel();
  refreshVodStars();
  updateCurFavBtn();
  setStatus("已从收藏夹删除");
}
async function loadAndPlayPod(p) {
  if (!(window.aurora && window.aurora.podcastEpisodes) && !biliApi.available) {
    setStatus("当前环境不支持播客", "error");
    return;
  }
  setStatus("正在打开收藏的播客…");
  try {
    const r = await apiPodcastEpisodes(p.feedUrl, p);
    bili.podEps = r.episodes || [];
    if (!bili.podResults.some((x) => vodKeyOf("pod", x) === vodKeyOf("pod", p))) bili.podResults.unshift(p);
    bili.podView = "episodes";
    setBiliMode("podcast");
    if (bili.podEps.length) playBili(bili.podEps[0], 1);
    setStatus(`「${r.podTitle || p.title}」已打开，正在播放最新一集`, "ok");
  } catch (err) {
    setStatus("打开播客失败：" + (err.message || "未知错误"), "error");
  }
}
function playFromVodFav(key) {
  const f = state.vodFavs.find((x) => x.key === key);
  if (!f) return;
  const d = f.data || {};
  if (f.type === "bili") playBili(d, f.page || 1);
  else if (f.type === "ep") playBili(d, 1);
  else loadAndPlayPod(d);
}
function openVodFavPanel() {
  renderVodFavPanel();
  els.vodFavPanel.classList.remove("hidden");
}
function updateCurFavBtn() {
  const on = bili.current && (() => {
    const { kind, item } = bili.current;
    return vodIsFaved(vodKeyOf(kind === "podcast" ? "ep" : "bili", item));
  })();
  els.biliFavCurBtn.textContent = on ? "★" : "☆";
  els.biliFavCurBtn.classList.toggle("on", !!on);
}

els.vodPinSlots.addEventListener("click", (e) => {
  const x = e.target.closest("[data-unpin]");
  if (x) { toggleVodPin(x.dataset.unpin); return; }
  const slot = e.target.closest(".vod-slot[data-key]");
  if (slot) { playFromVodFav(slot.dataset.key); return; }
  if (e.target.closest("[data-empty]")) openVodFavPanel();
});
els.vodPinSlots.addEventListener("contextmenu", (e) => {
  const slot = e.target.closest(".vod-slot[data-key]");
  if (slot) { e.preventDefault(); toggleVodPin(slot.dataset.key); }
});
els.vodFavList.addEventListener("click", (e) => {
  const row = e.target.closest(".history-item[data-key]");
  if (!row) return;
  const key = row.dataset.key;
  const op = e.target.closest("[data-act]");
  if (op) {
    if (op.dataset.act === "pin") toggleVodPin(key);
    else removeVodFav(key);
    return;
  }
  playFromVodFav(key);
  els.vodFavPanel.classList.add("hidden");
});
els.vodFavOpen.addEventListener("click", openVodFavPanel);
els.vodFavClose.addEventListener("click", () => els.vodFavPanel.classList.add("hidden"));
els.biliFavCurBtn.addEventListener("click", () => {
  if (!bili.current) { setStatus("当前没有播放 B站 / 播客内容", "error"); return; }
  const { kind, item } = bili.current;
  toggleVodFavByItem(kind === "podcast" ? "ep" : "bili", item);
});
renderVodPins();

els.biliResults.addEventListener("click", async (e) => {
  const star = e.target.closest(".vod-fav-star");
  if (star) {
    const it = vodListByType(star.dataset.vodtype)[+star.dataset.vodi];
    if (it) toggleVodFavByItem(star.dataset.vodtype, it, star.dataset.key);
    return;
  }
  if (e.target.closest(".pod-back")) {
    bili.podView = "search";
    renderBiliPodcast();
    return;
  }
  const item = e.target.closest(".bili-item");
  if (!item) return;
  if (item.dataset.kind === "pod") {
    const p = bili.podResults[+item.dataset.i];
    if (!p || (!(window.aurora && window.aurora.podcastEpisodes) && !biliApi.available)) return;
    setStatus("正在拉取播客单集…");
    try {
      const r = await apiPodcastEpisodes(p.feedUrl, p);
      bili.podEps = r.episodes || [];
      bili.podView = "episodes";
      renderBiliPodcast();
      els.biliResults.scrollTop = 0;
      setStatus(`「${r.podTitle || p.title}」共 ${bili.podEps.length} 集，点击即可收听`, "ok");
    } catch (err) {
      setStatus("拉取单集失败：" + (err.message || "未知错误"), "error");
    }
    return;
  }
  if (item.dataset.kind === "pod-ep") {
    const ep = bili.podEps[+item.dataset.i];
    if (ep) playBili(ep, 1);
    return;
  }
  const list = bili.mode === "author"
    ? ((bili.authors.find((a) => a.author === bili.curAuthor) || {}).items || [])
    : bili.items;
  const it = list[+item.dataset.i];
  if (it) playBili(it, 1);
});

els.biliPageSel.addEventListener("change", () => {
  if (bili.current) playBili(bili.current.item, +els.biliPageSel.value);
});

function biliCurrentList() {
  if (bili.mode === "podcast") return bili.podEps || [];
  return bili.mode === "author"
    ? ((bili.authors.find((a) => a.author === bili.curAuthor) || {}).items || [])
    : bili.items;
}
function vodKey(x) { return x.kind === "podcast" ? x.enclosure : x.bvid; }
function biliNextTarget() {
  if (!bili.current) return null;
  const { item, info } = bili.current;
  if (info && info.pages && info.pages.length > 1 && info.page < info.pages.length) {
    return { item, page: info.page + 1 };
  }
  const list = biliCurrentList();
  const idx = list.findIndex((x) => vodKey(x) === vodKey(item));
  if (idx >= 0 && idx + 1 < list.length) return { item: list[idx + 1], page: 1 };
  return null;
}
audio.addEventListener("ended", () => {
  if (!isBiliAudio() || !bili.auto) return;
  const nx = biliNextTarget();
  if (nx) {
    setStatus("自动连播：播放下一个节目…");
    playBili(nx.item, nx.page);
  }
});

async function playBili(item, page = 1) {
  if (!item) return;
  const isPod = item.kind === "podcast";
  try {
    let r;
    if (isPod) {
      setStatus("正在连接播客音频…");
      r = {
        title: item.title,
        author: item.artist || item.podTitle || "",
        pic: item.pic,
        duration: item.duration || 0,
        pages: [],
        page: 1,
        stream: window.aurora && window.aurora.podcastEpisodes
          ? "bilaudio://play/?u=" + encodeURIComponent(item.enclosure)
          : item.enclosure,
      };
    } else {
      if (!(window.aurora && window.aurora.biliResolve) && !biliApi.available) return;
      setStatus("正在解析 B 站音频流…");
      r = await apiResolve(item.bvid, page);
    }
    bili.current = { kind: isPod ? "podcast" : "bili", item, info: r };
    if (isPod) {
      registry.radio.recordHistory({ type: "pod", ep: item });
    } else {
      registry.radio.recordHistory({ type: "bili", bvid: item.bvid, page: r.page, name: r.title, author: r.author || item.author || "", pic: r.pic });
    }

    state.session = (state.session || 0) + 1;
    registry.radio.resetConnectAttempt();
    state.failing = false;
    registry.radio.stopWatchdog();
    registry.radio.clearConnectTimer();
    els.playerPanel.classList.remove("playing");

    const part = (r.pages.find((p) => p.page === r.page) || {}).part || "";
    const uuid = isPod
      ? "pod-" + String(item.enclosure || "").replace(/[^a-zA-Z0-9]/g, "").slice(-40)
      : `bili-${item.bvid}-${r.page}`;
    const pseudo = {
      stationuuid: uuid,
      name: !isPod && r.pages.length > 1 && part ? `${r.title} · P${r.page} ${part}` : r.title,
      country: isPod ? "播客" : "哔哩哔哩",
      countrycode: "",
      bitrate: "",
      codec: "",
      tags: (isPod ? "podcast," : "bilibili,") + (r.author || item.author || ""),
      favicon: r.pic,
      url_resolved: r.stream,
      url: r.stream,
    };
    state.curStation = pseudo;
    state.curIdx = null;
    state.current = -1;

    els.stationName.textContent = pseudo.name;
    els.stationCountry.textContent = (isPod ? "🎙 播客 · " : "📺 哔哩哔哩 · ") + (r.author || item.author || "");
    els.stationBitrate.textContent = (isPod ? "🎧 播客单集 · " : "🎬 视频转音频 · ") + fmtDur(r.duration);
    els.stationTags.innerHTML =
      `<span class="tag">${isPod ? "播客" : "bilibili"}</span>` +
      (r.author ? `<span class="tag">${escapeHtml(r.author)}</span>` : "");
    if (registry.fs) registry.fs.updateFSMeta(pseudo);
    els.artImg.style.display = r.pic ? "" : "none";
    els.artImg.src = r.pic || "";
    document.querySelectorAll(".station-item").forEach((el) => el.classList.remove("active"));
    registry.radio.updatePlayIcons();
    registry.radio.updateFavBtn();
    if (registry.room) registry.room.join(pseudo.stationuuid);

    audio.src = r.stream;
    audio.load();
    audio.play().then(() => {
      setStatus(`正在播放${isPod ? "播客" : " B 站音频"}：${pseudo.name}`, "ok");
    }).catch((e2) => {
      setStatus("音频播放失败：" + (e2.message || "未知错误"), "error");
    });

    els.progRow.classList.remove("hidden");
    els.progBar.value = 0;
    els.progCur.textContent = "0:00";
    els.progDur.textContent = r.duration ? fmtDur(r.duration) : "--:--";

    els.biliFooter.classList.remove("hidden");
    updateCurFavBtn();
    els.biliNowPic.src = r.pic || "";
    els.biliNowTitle.textContent = r.title;
    els.biliNowAuthor.textContent = r.author || item.author || "";
    if (!isPod && r.pages.length > 1) {
      els.biliPageSel.classList.remove("hidden");
      els.biliPageSel.innerHTML = r.pages
        .map((p) => `<option value="${p.page}"${p.page === r.page ? " selected" : ""}>P${p.page} ${escapeHtml(p.part || "")}</option>`)
        .join("");
    } else {
      els.biliPageSel.classList.add("hidden");
    }
  } catch (e) {
    setStatus((isPod ? "播客播放失败" : "B 站播放失败") + "：" + (e.message || "未知错误"), "error");
  }
}

/* ---------- 点播进度条 ---------- */
function isBiliAudio() {
  return !!(state.curStation && String(state.curStation.url_resolved || "").startsWith("bilaudio://"));
}
function biliDuration() {
  if (audio.duration && isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  return (bili.current && bili.current.info && bili.current.info.duration) || 0;
}
let progDragging = false;
els.progBar.addEventListener("pointerdown", () => { progDragging = true; });
window.addEventListener("pointerup", () => { progDragging = false; });
els.progBar.addEventListener("input", () => {
  const d = biliDuration();
  if (!d) return;
  audio.currentTime = (+els.progBar.value / 1000) * d;
  els.progCur.textContent = fmtDur(audio.currentTime);
});
audio.addEventListener("timeupdate", () => {
  if (!isBiliAudio()) return;
  const d = biliDuration();
  if (!d) return;
  els.progDur.textContent = fmtDur(d);
  if (!progDragging) {
    els.progBar.value = Math.min(1000, Math.round((audio.currentTime / d) * 1000));
  }
  els.progCur.textContent = fmtDur(audio.currentTime);
});
audio.addEventListener("ended", () => {
  if (isBiliAudio()) { els.progBar.value = 1000; }
});

/* ---------- B站手动上一首 / 下一首 ---------- */
function biliPrevTarget() {
  if (!bili.current) return null;
  const { item, info } = bili.current;
  if (info && info.pages && info.pages.length > 1 && info.page > 1) {
    return { item, page: info.page - 1 };
  }
  const list = biliCurrentList();
  const idx = list.findIndex((x) => vodKey(x) === vodKey(item));
  if (idx > 0) return { item: list[idx - 1], page: 1 };
  return null;
}
function biliSkip(dir) {
  if (!isBiliAudio() || !bili.current) {
    registry.radio.playIndex((state.current ?? -1) + dir);
    return;
  }
  const nx = dir > 0 ? biliNextTarget() : biliPrevTarget();
  if (nx) {
    playBili(nx.item, nx.page);
  } else {
    setStatus(dir > 0 ? "已经是搜索结果最后一个节目了" : "已经是搜索结果第一个节目了");
  }
}
els.biliPrevBtn.addEventListener("click", () => biliSkip(-1));
els.biliNextBtn.addEventListener("click", () => biliSkip(1));

/* ---------- 对外暴露 ---------- */
const api = {
  openBiliPanel,
  openVodFavPanel,
  playBili,
  biliSkip,
  isBiliAudio,
  fmtAgo,
};
registry.bili = api;

export default api;
