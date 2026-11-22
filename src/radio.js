/* Aurora FM — radio.js
 * 电台搜索 / 列表 / 播放状态机（多线路重连 + 看门狗）/ 收藏 / 收听护照 /
 * 盲盒 / 睡眠定时器 / 自动轮播 / 音量。
 */

import { els, state, audio, PAGE_SIZE, escapeHtml, flagFull, fmtDuration, setStatus, registry } from "./core.js";

const API_BASES = [
  "https://de1.api.radio-browser.info/json",
  "https://nl1.api.radio-browser.info/json",
  "https://at1.api.radio-browser.info/json",
];
let apiBase = null;

/* ---------- API ---------- */
async function getApiBase() {
  if (apiBase) return apiBase;
  for (const base of API_BASES) {
    try {
      const r = await fetch(base + "/servers", { signal: AbortSignal.timeout(6000) });
      if (r.ok) { apiBase = base; return base; }
    } catch (_) { /* try next */ }
  }
  throw new Error("无法连接 Radio Browser 服务器，请检查网络");
}

async function fetchStations(params) {
  const base = await getApiBase();
  const url = base + "/stations/search?" + new URLSearchParams(params).toString();
  const res = await fetch(url, {
    headers: { "User-Agent": "AuroraFM/1.0" },
  });
  if (!res.ok) throw new Error("API 请求失败 " + res.status);
  return res.json();
}

/* ---------- 列表加载 ---------- */
const FILTERS = {
  popular: { order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
  chinese: { tagList: "chinese", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
  music:   { tagList: "music", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
  news:    { tagList: "news", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
};

function setLoading() {
  els.stationList.innerHTML = Array(6).fill('<div class="skeleton"></div>').join("");
}

const MODE_PLACEHOLDER = {
  name: "电台名称，如：北京、交通广播、音乐台...",
  country: "国家/地区名（英文更准），如：China、Japan...",
  state: "省/州名（英文更准），如：California、Texas...",
  language: "语言，如：chinese、cantonese、english...",
  tag: "标签，如：jazz、rock、news、80s...",
};

const MODE_HINTS = {
  name: ["北京", "上海", "交通广播", "新闻广播", "音乐广播", "经济广播", "文艺广播"],
  country: ["China", "Hong Kong", "Taiwan", "Japan", "Korea", "United States", "United Kingdom", "France", "Germany", "Singapore", "Malaysia"],
  state: ["California", "New York", "Texas", "Bavaria", "Ontario", "New South Wales"],
  language: ["chinese", "cantonese", "english", "japanese", "korean", "spanish", "french", "german"],
  tag: ["jazz", "rock", "pop", "classical", "news", "talk", "sports", "80s", "90s", "lofi", "edm"],
};

function buildSearchParams() {
  const kw = state.keyword;
  const base = { order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE, offset: state.offset };
  if (!kw) return null; // 走分类
  switch (state.searchMode) {
    case "name":     return { ...base, name: kw };
    case "country":  return { ...base, country: kw };
    case "state":    return { ...base, state: kw };
    case "language": return { ...base, language: kw };
    case "tag":      return { ...base, tagList: kw };
    default:         return { ...base, name: kw };
  }
}

function refreshHints() {
  const hints = MODE_HINTS[state.searchMode] || [];
  els.searchHints.innerHTML = hints.map((h) => `<option value="${escapeHtml(h)}">`).join("");
  els.searchInput.placeholder = MODE_PLACEHOLDER[state.searchMode] || "搜索...";
}

async function load(reset = true) {
  if (reset) { state.offset = 0; state.stations = []; setLoading(); }
  els.moreBtn.classList.add("hidden");
  const params = buildSearchParams() ||
    { ...FILTERS[state.filter], offset: state.offset };
  try {
    const list = await fetchStations(params);
    const seen = new Set(state.stations.map((s) => s.stationuuid));
    const fresh = list.filter((s) => !seen.has(s.stationuuid));
    state.stations = reset ? fresh : state.stations.concat(fresh);
    state.offset += PAGE_SIZE;
    renderList();
    if (list.length === PAGE_SIZE) els.moreBtn.classList.remove("hidden");
  } catch (e) {
    els.stationList.innerHTML = `<div class="status-bar error" style="padding:20px">${e.message}</div>`;
  }
}

function renderList() {
  els.stationCount.textContent = state.stations.length + " 个电台";
  if (!state.stations.length) {
    const tip = {
      country: "试试英文名，如 China、Japan；或直接点下方「中国全部」快捷入口",
      state: "州/省字段覆盖有限，建议改用「电台名」搜索，如：北京、广东",
      language: "常用值：chinese（普通话）、cantonese（粤语）、english",
      tag: "常用标签：jazz、news、rock、lofi...",
      name: "换个关键词，或切换搜索维度（国家/语言/标签）试试",
    }[state.searchMode] || "换个关键词试试";
    els.stationList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim);font-size:13px">没有找到电台 🎧<br>${tip}</div>`;
    return;
  }
  els.stationList.innerHTML = state.stations
    .map((s, i) => {
      const logo = s.favicon
        ? `<img src="${escapeHtml(s.favicon)}" onerror="this.remove()">`
        : "📻";
      const active = i === state.current ? " active" : "";
      const fav = state.favorites.some((f) => f.stationuuid === s.stationuuid) ? " ⭐" : "";
      return `
      <div class="station-item${active}" data-i="${i}">
        <div class="station-logo">${logo}</div>
        <div class="station-info">
          <div class="name">${escapeHtml(s.name)}${fav}</div>
          <div class="sub">${escapeHtml(s.country || "")} · ${s.bitrate || "?"}kbps · ${s.codec || ""}</div>
        </div>
        <div class="playing-indicator"><span></span><span></span><span></span></div>
      </div>`;
    })
    .join("");
  refreshPlayingIndicator();
}

function refreshPlayingIndicator() {
  const playing = !audio.paused && !!audio.src;
  document.querySelectorAll(".station-item").forEach((el) => {
    const isCur = state.current != null && +el.dataset.i === state.current;
    el.classList.toggle("is-playing", playing && isCur);
  });
}

/* ---------- 收听统计（电台护照） ---------- */
function saveStats() {
  localStorage.setItem("aurora_stats", JSON.stringify({
    seconds: state.stats.seconds,
    stations: [...state.stats.stations],
    countries: [...state.stats.countries],
    night: state.stats.night,
  }));
}

function recordListen(s) {
  state.stats.stations.add(s.stationuuid);
  if (s.countrycode || s.country) state.stats.countries.add(s.countrycode || s.country);
  if (new Date().getHours() < 5) state.stats.night = true;
  saveStats();
}

// 每秒累计收听时长（播放中才计时）
setInterval(() => {
  if (!audio.paused && state.current >= 0) {
    state.stats.seconds++;
    if (state.stats.seconds % 10 === 0) saveStats();
  }
}, 1000);

const BADGES = [
  { icon: "🎧", name: "初次启程", desc: "收听第一个电台", check: (st) => st.stations.size >= 1 },
  { icon: "🌏", name: "环球旅行家", desc: "收听 5 个不同国家/地区的电台", check: (st) => st.countries.size >= 5 },
  { icon: "🧭", name: "电波探索者", desc: "尝试过 20 个电台", check: (st) => st.stations.size >= 20 },
  { icon: "⭐", name: "收藏家", desc: "收藏 10 个电台", check: () => state.favorites.length >= 10 },
  { icon: "🦉", name: "午夜电波", desc: "在凌晨 0-5 点听过电台", check: (st) => st.night },
  { icon: "⏳", name: "马拉松听众", desc: "累计收听 5 小时", check: (st) => st.seconds >= 5 * 3600 },
];

function openPassport() {
  const st = state.stats;
  els.passportStats.innerHTML = `
    <div class="pstat"><b>${fmtDuration(st.seconds)}</b><span>累计收听</span></div>
    <div class="pstat"><b>${st.stations.size}</b><span>探索电台</span></div>
    <div class="pstat"><b>${st.countries.size}</b><span>到达地区</span></div>
    <div class="pstat"><b>${state.favorites.length}</b><span>收藏电台</span></div>`;
  const done = BADGES.map((b) => b.check(st));
  els.badgeGrid.innerHTML = BADGES.map((b, i) => `
    <div class="badge${done[i] ? " unlocked" : ""}" title="${b.desc}">
      <div class="badge-icon">${done[i] ? b.icon : "🔒"}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
    </div>`).join("");
  els.passportOverlay.classList.remove("hidden");
}

/* ---------- 盲盒电台 ---------- */
async function openBlind() {
  els.blindResult.classList.add("hidden");
  els.blindRoll.textContent = "正在起飞，随机搜索全球电台...";
  els.blindOverlay.classList.remove("hidden");

  let s = null;
  try {
    const base = await getApiBase();
    const res = await fetch(base + "/stations/search?" + new URLSearchParams({
      order: "random", hidebroken: "true", limit: "1",
    }));
    const list = await res.json();
    if (list.length) s = list[0];
  } catch (_) { /* fallthrough */ }

  const names = state.stations.length
    ? state.stations.map((x) => x.name)
    : ["Tokyo FM", "Radio Paris", "Berlin 88.8"];
  let ticks = 0;
  const rollTimer = setInterval(() => {
    els.blindRoll.textContent = "✈️ " + names[Math.floor(Math.random() * names.length)];
    if (++ticks > 14) {
      clearInterval(rollTimer);
      if (s) {
        state.blindPending = s;
        els.blindFlag.textContent = flagFull(s.countrycode);
        els.blindName.textContent = s.name;
        els.blindCountry.textContent = `${s.country || "未知"} · ${s.bitrate || "?"} kbps · 已收到信号 📶`;
        els.blindResult.classList.remove("hidden");
      } else {
        els.blindRoll.textContent = "信号丢失了...点击空白处再试一次 🛸";
      }
    }
  }, 90);
}

function playBlind() {
  const s = state.blindPending;
  if (!s) return;
  els.blindOverlay.classList.add("hidden");
  if (!state.stations.some((x) => x.stationuuid === s.stationuuid)) {
    state.stations.push(s);
    renderList();
  }
  playStation(s, state.stations.findIndex((x) => x.stationuuid === s.stationuuid));
}

/* ---------- 睡眠定时器 ---------- */
function startSleep(minutes) {
  stopSleep(false);
  if (minutes <= 0) { els.sleepLabel.textContent = "助眠"; return; }
  state.sleepRemaining = minutes * 60;
  state.sleepTargetVol = audio.volume;
  state.sleepTimer = setInterval(() => {
    state.sleepRemaining--;
    const m = Math.floor(state.sleepRemaining / 60), s = state.sleepRemaining % 60;
    els.sleepLabel.textContent = `${m}:${String(s).padStart(2, "0")}`;
    if (state.sleepRemaining <= 60 && state.sleepRemaining > 0) {
      audio.volume = Math.max(0, state.sleepTargetVol * (state.sleepRemaining / 60));
    }
    if (state.sleepRemaining <= 0) {
      audio.pause();
      els.playerPanel.classList.remove("playing");
      setStatus("😴 助眠结束，电台已暂停，晚安", "ok");
      stopSleep(false);
      setTimeout(() => {
        audio.volume = state.sleepTargetVol;
        setVolume(Math.round(state.sleepTargetVol * 100));
      }, 800);
    }
  }, 1000);
  els.sleepBtn.classList.add("on");
  setStatus(`😴 助眠定时已开启：${minutes} 分钟后渐弱关闭`, "ok");
}

function stopSleep(resetSelect = true) {
  if (state.sleepTimer) clearInterval(state.sleepTimer);
  state.sleepTimer = null;
  state.sleepRemaining = 0;
  els.sleepBtn.classList.remove("on");
  if (resetSelect) { els.sleepInterval.value = "0"; els.sleepLabel.textContent = "助眠"; }
}

/* ---------- 播放 ---------- */
function playIndex(i) {
  if (!state.stations.length) return;
  if (i < 0) i = state.stations.length - 1;
  if (i >= state.stations.length) i = 0;
  playStation(state.stations[i], i);
}

function playStation(s, idx = null) {
  if (!s) return;
  state.current = idx;
  els.stationName.textContent = s.name;
  els.stationCountry.textContent = flagFull(s.countrycode) + " " + (s.country || "未知地区");
  els.stationBitrate.textContent = "✨ " + (s.bitrate ? s.bitrate + " kbps · " + (s.codec || "") : "在线电台");
  els.stationTags.innerHTML = (s.tags || "")
    .split(",").filter(Boolean).slice(0, 4)
    .map((t) => `<span class="tag">${escapeHtml(t.trim())}</span>`).join("") ||
    '<span class="tag">在线电台</span>';
  if (registry.fs) registry.fs.updateFSMeta(s);
  if (registry.room) registry.room.join(s.stationuuid);   // 加入该电台的弹幕频道

  els.artImg.style.display = "";
  els.artImg.src = s.favicon || "";
  if (!s.favicon) els.artImg.style.display = "none";

  document.querySelectorAll(".station-item").forEach((el) =>
    el.classList.toggle("active", idx != null && +el.dataset.i === idx));
  refreshPlayingIndicator();
  if (idx != null) {
    document.querySelector(`.station-item[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  updateFavBtn();
  localStorage.setItem("aurora_last", s.stationuuid);
  state.curStation = s;
  state.curIdx = idx;
  recordHistory({ type: "radio", s });
  state.session = (state.session || 0) + 1;
  connectAttempt = 0;
  state.failing = false;
  els.playerPanel.classList.remove("playing");
  els.progRow.classList.add("hidden");   // 电台是实时直播流，隐藏点播进度条
  attemptPlay(s, idx);
}

/* ---------- 连接状态机：多线路 + 超时宽限 + 指数耐心 ---------- */
let connectAttempt = 0;
const MAX_CONNECT = 4;
let connectTimer = null;
let watchdog = null;
let lastTime = 0;
let stallTicks = 0;

function clearConnectTimer() {
  if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
}

function attemptPlay(s, idx) {
  connectAttempt++;
  state.failing = false;
  const urls = [...new Set([s.url_resolved, s.url].filter(Boolean))];
  const pick = (connectAttempt - 1) % urls.length;
  setStatus(`正在连接 ${s.name} ...（尝试 ${connectAttempt}/${MAX_CONNECT} · 线路 ${pick + 1}/${urls.length}）`);
  audio.src = urls[pick];
  audio.load();

  clearConnectTimer();
  const session = state.session;
  connectTimer = setTimeout(() => {
    if (session === state.session) handleFail(s, idx);
  }, 12000);

  audio.play().catch(() => {
    if (session === state.session) handleFail(s, idx);
  });
  startWatchdog();
}

function handleFail(s, idx) {
  if (state.failing) return;
  state.failing = true;
  const session = state.session;
  if (connectAttempt >= MAX_CONNECT) {
    connectAttempt = 0;
    setStatus(`「${s.name}」多次连接失败，已切换下一台 ▶`, "error");
    setTimeout(() => {
      if (session === state.session) playIndex(state.curIdx + 1);
    }, 800);
  } else {
    setStatus(`连接不稳，稍后重试（${connectAttempt}/${MAX_CONNECT}）...`);
    setTimeout(() => {
      state.failing = false;
      if (session === state.session) attemptPlay(s, idx);
    }, 1500);
  }
}

audio.addEventListener("playing", () => {
  clearConnectTimer();
  connectAttempt = 0;
  state.failing = false;
  updatePlayIcons();
  if (state.curStation) {
    setStatus("正在播放 · " + state.curStation.name, "ok");
    els.playerPanel.classList.add("playing");
    recordListen(state.curStation);
  }
});

/* ---------- 播放看门狗：卡顿检测与自动重连 ---------- */
function startWatchdog() {
  stopWatchdog();
  lastTime = 0;
  stallTicks = 0;
  watchdog = setInterval(() => {
    if (audio.paused || audio.readyState < 2) return;
    if (audio.currentTime > lastTime + 0.05) {
      lastTime = audio.currentTime;
      stallTicks = 0;
      return;
    }
    stallTicks++;
    if (stallTicks >= 4) {
      stallTicks = 0;
      if (state.curStation) attemptPlay(state.curStation, state.curIdx);
    }
  }, 2000);
}

function stopWatchdog() {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
}

audio.addEventListener("error", () => {
  if (state.curStation) attemptPlay(state.curStation, state.curIdx);
});

function updatePlayIcons() {
  const playing = !audio.paused && !!audio.src;
  els.iconPlay.classList.toggle("hidden", playing);
  els.iconPause.classList.toggle("hidden", !playing);
  els.fsIconPlay.classList.toggle("hidden", playing);
  els.fsIconPause.classList.toggle("hidden", !playing);
  refreshPlayingIndicator();
  if (registry.fs) registry.fs.pushMiniInfo();
}
audio.addEventListener("play", updatePlayIcons);
audio.addEventListener("pause", updatePlayIcons);
audio.addEventListener("ended", updatePlayIcons);

function togglePlay() {
  if (registry.bili && registry.bili.isBiliAudio()) {
    if (audio.paused) {
      audio.play().then(() => {
        els.playerPanel.classList.add("playing");
        setStatus("正在播放 · " + (state.curStation ? state.curStation.name : ""), "ok");
      }).catch(() => setStatus("播放失败，请点击列表重新播放", "error"));
    } else {
      audio.pause();
      els.playerPanel.classList.remove("playing");
      setStatus("已暂停");
    }
    setTimeout(renderList, 50);
    return;
  }
  if (state.current < 0) { playIndex(0); return; }
  if (audio.paused) {
    audio.play().then(() => {
      els.playerPanel.classList.add("playing");
      setStatus("正在播放", "ok");
    }).catch(() => setStatus("播放失败，请尝试其他电台", "error"));
  } else {
    audio.pause();
    els.playerPanel.classList.remove("playing");
    setStatus("已暂停");
  }
  setTimeout(renderList, 50);
}

/* ---------- 音量 ---------- */
function setVolume(v) {
  audio.volume = v / 100;
  audio.muted = state.muted;
  els.volumeText.textContent = v + "%";
  els.volumeSlider.value = v;
  els.volumeSlider.style.setProperty("--fill", v + "%");
  localStorage.setItem("aurora_vol", String(v));
}

function toggleMute() {
  state.muted = !state.muted;
  audio.muted = state.muted;
  localStorage.setItem("aurora_muted", state.muted ? "1" : "0");
  els.iconVol.classList.toggle("hidden", state.muted);
  els.iconMute.classList.toggle("hidden", !state.muted);
}

/* ---------- 自动轮播 ---------- */
function startAuto() {
  stopAuto();
  const sec = +els.autoInterval.value;
  const min = Math.round(sec / 60);
  state.autoTimer = setInterval(() => {
    setStatus("自动轮播：切换到下一台 ▶");
    playIndex(state.current + 1);
  }, sec * 1000);
  els.autoBtn.classList.add("on");
  els.autoLabel.textContent = `轮播 ${min} 分钟`;
  setStatus(`自动轮播已开启：每 ${min} 分钟换台`, "ok");
}
function stopAuto() {
  if (state.autoTimer) clearInterval(state.autoTimer);
  state.autoTimer = null;
  els.autoBtn.classList.remove("on");
  els.autoLabel.textContent = "自动轮播";
}

/* ---------- 收藏 ---------- */
function updateFavBtn() {
  if (state.current < 0) { els.favLabel.textContent = "收藏"; return; }
  const s = state.stations[state.current];
  const isFav = state.favorites.some((f) => f.stationuuid === s.stationuuid);
  els.favBtn.classList.toggle("on", isFav);
  els.favLabel.textContent = isFav ? "已收藏" : "收藏";
}

function toggleFav() {
  if (state.current < 0) { setStatus("请先选择一个电台", "error"); return; }
  const s = state.stations[state.current];
  const idx = state.favorites.findIndex((f) => f.stationuuid === s.stationuuid);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    setStatus("已取消收藏");
  } else {
    state.favorites.push(s);
    setStatus("已收藏 ⭐", "ok");
  }
  localStorage.setItem("aurora_fav", JSON.stringify(state.favorites));
  updateFavBtn();
  renderList();
}

/* ---------- 播放历史（radio 类型由 radio 记录，bili/pod 由 bili 模块记录） ---------- */
function recordHistory(entry) {
  if (!registry.bili) { /* bili 未初始化时仅记 radio */ }
  try {
    const key = entry.type === "bili" ? `bili-${entry.bvid}-${entry.page}`
      : entry.type === "pod" ? `pod-${entry.ep.enclosure}`
      : entry.s.stationuuid;
    const h = state.history.filter((x) => x.key !== key);
    h.unshift(Object.assign({ key, ts: Date.now() }, entry));
    state.history = h.slice(0, 50);
    localStorage.setItem("aurora_history", JSON.stringify(state.history));
  } catch (_) { /* ignore */ }
}

function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<div class="history-empty">还没有播放记录，去听几台电台吧 🎧</div>';
    return;
  }
  els.historyList.innerHTML = state.history.map((h, i) => {
    if (h.type === "pod") {
      const ep = h.ep || {};
      return `
        <div class="history-item" data-i="${i}" title="${escapeHtml(ep.title)}">
          <img class="history-thumb" src="${escapeHtml(ep.pic || "")}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
          <div class="history-info">
            <div class="history-name">${escapeHtml(ep.title)}</div>
            <div class="history-sub">🎙 ${escapeHtml(ep.artist || ep.podTitle || "播客")} · 单集回放</div>
          </div>
          <span class="history-time">${registry.bili ? registry.bili.fmtAgo(h.ts) : ""}</span>
        </div>`;
    }
    if (h.type === "bili") {
      return `
        <div class="history-item" data-i="${i}" title="${escapeHtml(h.name)}">
          <img class="history-thumb" src="${escapeHtml(h.pic || "")}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
          <div class="history-info">
            <div class="history-name">${escapeHtml(h.name)}${h.page > 1 ? " · P" + h.page : ""}</div>
            <div class="history-sub">📺 ${escapeHtml(h.author || "哔哩哔哩")} · 点播回放</div>
          </div>
          <span class="history-time">${registry.bili ? registry.bili.fmtAgo(h.ts) : ""}</span>
        </div>`;
    }
    return `
      <div class="history-item" data-i="${i}" title="${escapeHtml(h.s.name)}">
        <img class="history-thumb" src="${escapeHtml(h.s.favicon || "")}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
        <div class="history-info">
          <div class="history-name">${escapeHtml(h.s.name)}</div>
          <div class="history-sub">${flagFull(h.s.countrycode)} ${escapeHtml(h.s.country || "未知地区")}</div>
        </div>
        <span class="history-time">${registry.bili ? registry.bili.fmtAgo(h.ts) : ""}</span>
      </div>`;
  }).join("");
}

function openHistory() {
  renderHistory();
  els.historyPanel.classList.remove("hidden");
}

/* ---------- 事件绑定 ---------- */
els.searchBtn.addEventListener("click", () => {
  state.keyword = els.searchInput.value.trim();
  if (!state.keyword) setStatus("请输入搜索内容，或点击下方地方台快捷入口");
  load();
});
els.searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.searchBtn.click();
});
els.searchMode.addEventListener("change", () => {
  state.searchMode = els.searchMode.value;
  refreshHints();
  if (els.searchInput.value.trim()) els.searchBtn.click();
});

els.quickChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  if (chip.dataset.bili) { if (registry.bili) registry.bili.openBiliPanel(); return; }
  if (chip.dataset.vodfav) { if (registry.bili) registry.bili.openVodFavPanel(); return; }
  state.searchMode = chip.dataset.mode;
  els.searchMode.value = state.searchMode;
  refreshHints();
  state.keyword = chip.dataset.value;
  els.searchInput.value = state.keyword;
  load();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.filter = tab.dataset.filter;
    state.keyword = "";
    els.searchInput.value = "";
    load();
  });
});

els.stationList.addEventListener("click", (e) => {
  const item = e.target.closest(".station-item");
  if (item) playIndex(+item.dataset.i);
});

els.moreBtn.addEventListener("click", () => load(false));

els.playBtn.addEventListener("click", togglePlay);
els.prevBtn.addEventListener("click", () => playIndex(state.current - 1));
els.nextBtn.addEventListener("click", () => playIndex(state.current + 1));

els.autoBtn.addEventListener("click", () => {
  state.autoTimer ? stopAuto() : startAuto();
});

els.favBtn.addEventListener("click", toggleFav);

els.blindBtn.addEventListener("click", openBlind);
els.blindOverlay.addEventListener("click", (e) => {
  if (e.target === els.blindOverlay) els.blindOverlay.classList.add("hidden");
});
els.blindGo.addEventListener("click", playBlind);

els.passportBtn.addEventListener("click", openPassport);
els.passportClose.addEventListener("click", () => els.passportOverlay.classList.add("hidden"));
els.passportOverlay.addEventListener("click", (e) => {
  if (e.target === els.passportOverlay) els.passportOverlay.classList.add("hidden");
});

els.sleepInterval.addEventListener("change", (e) => startSleep(+e.target.value));
els.sleepBtn.addEventListener("click", (e) => {
  if (e.target.tagName === "SELECT") return;
  if (state.sleepTimer) {
    stopSleep();
    setStatus("已取消助眠定时");
  }
});

els.volumeSlider.addEventListener("input", (e) => setVolume(+e.target.value));
els.muteBtn.addEventListener("click", toggleMute);

audio.addEventListener("ended", () => {
  if (registry.bili && registry.bili.isBiliAudio()) return;
  if (state.curStation) {
    setStatus("电台流中断，尝试重新连接...");
    attemptPlay(state.curStation, state.curIdx);
  }
});

els.historyBtn.addEventListener("click", openHistory);
els.historyClose.addEventListener("click", () => els.historyPanel.classList.add("hidden"));
els.historyClear.addEventListener("click", () => {
  state.history = [];
  localStorage.removeItem("aurora_history");
  renderHistory();
  setStatus("播放历史已清空");
});
els.historyList.addEventListener("click", (e) => {
  const item = e.target.closest(".history-item");
  if (!item) return;
  const h = state.history[+item.dataset.i];
  if (!h) return;
  if (h.type === "pod") {
    registry.bili.playBili(h.ep, 1);
  } else if (h.type === "bili") {
    registry.bili.playBili({ bvid: h.bvid, author: h.author, title: h.name, pic: h.pic }, h.page || 1);
  } else {
    const idx = state.stations.findIndex((x) => x.stationuuid === h.s.stationuuid);
    playStation(h.s, idx >= 0 ? idx : null);
  }
});

/* ---------- 对外暴露 ---------- */
const api = {
  load,
  renderList,
  refreshHints,
  playIndex,
  playStation,
  togglePlay,
  setVolume,
  toggleMute,
  startAuto,
  stopAuto,
  startSleep,
  stopSleep,
  stopWatchdog,
  clearConnectTimer,
  saveStats,
  recordListen,
  recordHistory,
  renderHistory,
  openPassport,
  openBlind,
  playBlind,
  updateFavBtn,
  updatePlayIcons,
  // 点播播放时需把电台连接状态机复位（供 bili.js 调用）
  resetConnectAttempt: () => { connectAttempt = 0; },
};
registry.radio = api;

export default api;
