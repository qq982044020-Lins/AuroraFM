/* Aurora FM — 基于 Radio Browser 免费公开 API */
(() => {
  const API_BASES = [
    "https://de1.api.radio-browser.info/json",
    "https://nl1.api.radio-browser.info/json",
    "https://at1.api.radio-browser.info/json",
  ];
  let apiBase = null;

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");

  const els = {
    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),
    searchMode: $("searchMode"),
    searchHints: $("searchHints"),
    quickChips: $("quickChips"),
    stationList: $("stationList"),
    stationCount: $("stationCount"),
    moreBtn: $("moreBtn"),
    stationName: $("stationName"),
    stationTags: $("stationTags"),
    stationCountry: $("stationCountry"),
    stationBitrate: $("stationBitrate"),
    artImg: $("artImg"),
    artwork: $("artwork"),
    playBtn: $("playBtn"),
    iconPlay: $("iconPlay"),
    iconPause: $("iconPause"),
    prevBtn: $("prevBtn"),
    nextBtn: $("nextBtn"),
    autoBtn: $("autoBtn"),
    autoLabel: $("autoLabel"),
    autoInterval: $("autoInterval"),
    favBtn: $("favBtn"),
    favLabel: $("favLabel"),
    volumeSlider: $("volumeSlider"),
    volumeText: $("volumeText"),
    muteBtn: $("muteBtn"),
    iconVol: $("iconVol"),
    iconMute: $("iconMute"),
    statusBar: $("statusBar"),
    playerPanel: document.querySelector(".player-panel"),
    vizCanvas: $("vizCanvas"),
    titlebar: $("titlebar"),
    fsBtn: $("fsBtn"),
    fsOverlay: $("fsOverlay"),
    fsExit: $("fsExit"),
    fsClock: $("fsClock"),
    fsDate: $("fsDate"),
    fsName: $("fsName"),
    fsInfo: $("fsInfo"),
    fsTags: $("fsTags"),
    fsCanvas: $("fsCanvas"),
    fsModeLabel: $("fsModeLabel"),
    fsPrev: $("fsPrev"),
    fsPlay: $("fsPlay"),
    fsNext: $("fsNext"),
    fsIconPlay: $("fsIconPlay"),
    fsIconPause: $("fsIconPause"),
    blindBtn: $("blindBtn"),
    blindOverlay: $("blindOverlay"),
    blindRoll: $("blindRoll"),
    blindResult: $("blindResult"),
    blindFlag: $("blindFlag"),
    blindName: $("blindName"),
    blindCountry: $("blindCountry"),
    blindGo: $("blindGo"),
    passportBtn: $("passportBtn"),
    passportOverlay: $("passportOverlay"),
    passportStats: $("passportStats"),
    badgeGrid: $("badgeGrid"),
    passportClose: $("passportClose"),
    historyBtn: $("historyBtn"),
    historyPanel: $("historyPanel"),
    historyClose: $("historyClose"),
    historyList: $("historyList"),
    historyClear: $("historyClear"),
    sleepBtn: $("sleepBtn"),
    sleepLabel: $("sleepLabel"),
    sleepInterval: $("sleepInterval"),
    roomCount: $("roomCount"),
    roomPanel: $("roomPanel"),
    roomPanelClose: $("roomPanelClose"),
    roomPanelSave: $("roomPanelSave"),
    roomPanelReset: $("roomPanelReset"),
    roomGroupInput: $("roomGroupInput"),
    roomServerInput: $("roomServerInput"),
    roomLanHint: $("roomLanHint"),
    biliPanel: $("biliPanel"),
    biliPanelClose: $("biliPanelClose"),
    biliSearchInput: $("biliSearchInput"),
    biliSearchBtn: $("biliSearchBtn"),
    biliResults: $("biliResults"),
    biliAuthors: $("biliAuthors"),
    biliModeVideo: $("biliModeVideo"),
    biliModeAuthor: $("biliModeAuthor"),
    biliModePod: $("biliModePod"),
    biliPanelTitle: $("biliPanelTitle"),
    biliSortDefault: $("biliSortDefault"),
    biliSortNew: $("biliSortNew"),
    biliAutoBtn: $("biliAutoBtn"),
    biliCatChips: $("biliCatChips"),
    biliHistRow: $("biliHistRow"),
    biliHistChips: $("biliHistChips"),
    biliHistClear: $("biliHistClear"),
    progRow: $("progRow"),
    progBar: $("progBar"),
    progCur: $("progCur"),
    progDur: $("progDur"),
    biliFooter: $("biliFooter"),
    biliNowPic: $("biliNowPic"),
    biliNowTitle: $("biliNowTitle"),
    biliNowAuthor: $("biliNowAuthor"),
    biliPageSel: $("biliPageSel"),
    biliPrevBtn: $("biliPrevBtn"),
    biliNextBtn: $("biliNextBtn"),
    danmakuLayer: $("danmakuLayer"),
    danmakuInput: $("danmakuInput"),
    danmakuSend: $("danmakuSend"),
    dmNick: $("dmNick"),
    winMini: $("winMini"),
    quoteBar: $("quoteBar"),
    quoteText: $("quoteText"),
    quoteNext: $("quoteNext"),
    vodPinSlots: $("vodPinSlots"),
    vodFavOpen: $("vodFavOpen"),
    vodFavCount: $("vodFavCount"),
    vodFavPanel: $("vodFavPanel"),
    vodFavClose: $("vodFavClose"),
    vodFavList: $("vodFavList"),
    biliFavCurBtn: $("biliFavCurBtn"),
  };

  const state = {
    stations: [],
    current: -1,
    offset: 0,
    filter: "popular",
    keyword: "",
    searchMode: "name",
    autoTimer: null,
    sleepTimer: null,
    sleepRemaining: 0,
    sleepTargetVol: 80,
    stats: (() => {
      try {
        const s = JSON.parse(localStorage.getItem("aurora_stats") || "{}");
        return {
          seconds: s.seconds || 0,
          stations: new Set(s.stations || []),
          countries: new Set(s.countries || []),
          night: !!s.night,
        };
      } catch (_) {
        return { seconds: 0, stations: new Set(), countries: new Set(), night: false };
      }
    })(),
    blindPending: null,
    muted: false,
    favorites: JSON.parse(localStorage.getItem("aurora_fav") || "[]"),
    history: (() => {
      try { return JSON.parse(localStorage.getItem("aurora_history") || "[]"); }
      catch (_) { return []; }
    })(),
    // 点播收藏夹（B站 / 播客）与置顶栏（最多 5 个）
    vodFavs: (() => {
      try { return JSON.parse(localStorage.getItem("aurora_vod_fav") || "[]"); }
      catch (_) { return []; }
    })(),
    vodPins: (() => {
      try {
        const p = JSON.parse(localStorage.getItem("aurora_vod_pin") || "[]");
        return Array.isArray(p) ? p.slice(0, 5) : [];
      } catch (_) { return []; }
    })(),
  };

  const PAGE_SIZE = 40;

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

  /* ---------- 加载列表 ---------- */
  const FILTERS = {
    popular: { order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
    chinese: { tagList: "chinese", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
    music:   { tagList: "music", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
    news:    { tagList: "news", order: "votes", reverse: "true", hidebroken: "true", limit: PAGE_SIZE },
  };

  function setLoading() {
    els.stationList.innerHTML = Array(6).fill('<div class="skeleton"></div>').join("");
  }

  /* ---------- 搜索参数构建 ---------- */
  const MODE_PLACEHOLDER = {
    name: "电台名称，如：北京、交通广播、音乐台...",
    country: "国家/地区名（英文更准），如：China、Japan...",
    state: "省/州名（英文更准），如：California、Texas...",
    language: "语言，如：chinese、cantonese、english...",
    tag: "标签，如：jazz、rock、news、80s...",
  };

  // 各维度的常用输入建议
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
      // 去重
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

  // 统一同步列表里的「正在播放」跳动条：只跟随当前选中项且确实在播放时显示
  function refreshPlayingIndicator() {
    const playing = !audio.paused && !!audio.src;
    document.querySelectorAll(".station-item").forEach((el) => {
      const isCur = state.current != null && +el.dataset.i === state.current;
      el.classList.toggle("is-playing", playing && isCur);
    });
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  /* ---------- 国旗 emoji ---------- */
  function flagFull(cc) {
    if (!cc || cc.length !== 2) return "🌐";
    return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
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

  function fmtDuration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分 ${sec % 60} 秒`;
  }

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

    // 老虎机式滚动名字
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
    // 加入列表尾部以便上下台切换，并渲染高亮
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
        // 最后 1 分钟音量线性渐弱
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
    updateFSMeta(s);
    room.join(s.stationuuid);   // 加入该电台的弹幕频道

    els.artImg.style.display = "";
    els.artImg.src = s.favicon || "";
    if (!s.favicon) els.artImg.style.display = "none";

    // 高亮列表项 + 同步播放指示器（切台时立即跟随）
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
  const MAX_CONNECT = 4;        // 最多尝试 4 次（交替使用不同线路）
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
    // 候选线路：url_resolved 优先，url 兜底
    const urls = [...new Set([s.url_resolved, s.url].filter(Boolean))];
    const pick = (connectAttempt - 1) % urls.length;
    setStatus(`正在连接 ${s.name} ...（尝试 ${connectAttempt}/${MAX_CONNECT} · 线路 ${pick + 1}/${urls.length}）`);
    audio.src = urls[pick];
    audio.load();

    // 12 秒内没真正出声 → 判定失败（给慢速流足够时间缓冲）
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

  // 真正出声（playing 事件）才算连接成功，重置计数
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
      // 暂停或缓冲中不算卡死
      if (audio.paused || audio.readyState < 2) return;
      if (audio.currentTime > lastTime + 0.05) {
        // 播放正常推进
        lastTime = audio.currentTime;
        stallTicks = 0;
        return;
      }
      // 连续约 8 秒播放进度无推进 → 重连
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

  // 流中断/解码错误 → 重连
  audio.addEventListener("error", () => {
    if (state.curStation) attemptPlay(state.curStation, state.curIdx);
  });

  // 播放/暂停图标统一由音频事件驱动（修复点击后图标不切换的 bug）
  function updatePlayIcons() {
    const playing = !audio.paused && !!audio.src;
    els.iconPlay.classList.toggle("hidden", playing);
    els.iconPause.classList.toggle("hidden", !playing);
    els.fsIconPlay.classList.toggle("hidden", playing);
    els.fsIconPause.classList.toggle("hidden", !playing);
    refreshPlayingIndicator();
    pushMiniInfo();
  }
  audio.addEventListener("play", updatePlayIcons);
  audio.addEventListener("pause", updatePlayIcons);
  audio.addEventListener("ended", updatePlayIcons);

  function togglePlay() {
    // B站/播客点播：直接恢复/暂停当前音频，绝不跳回电台列表
    if (isBiliAudio()) {
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

  function setStatus(msg, type = "") {
    els.statusBar.textContent = msg;
    els.statusBar.className = "status-bar " + type;
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
    const sec = +els.autoInterval.value;        // 选项值单位是秒（120/300/600）
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
    // 已有内容时自动按新维度搜索
    if (els.searchInput.value.trim()) els.searchBtn.click();
  });

  // 地方电台快捷入口（含 B站电台弹窗入口）
  els.quickChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    if (chip.dataset.bili) { openBiliPanel(); return; }
    if (chip.dataset.vodfav) { openVodFavPanel(); return; }
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

  // 盲盒
  els.blindBtn.addEventListener("click", openBlind);
  els.blindOverlay.addEventListener("click", (e) => {
    if (e.target === els.blindOverlay) els.blindOverlay.classList.add("hidden");
  });
  els.blindGo.addEventListener("click", playBlind);

  // 电台护照
  els.passportBtn.addEventListener("click", openPassport);
  els.passportClose.addEventListener("click", () => els.passportOverlay.classList.add("hidden"));
  els.passportOverlay.addEventListener("click", (e) => {
    if (e.target === els.passportOverlay) els.passportOverlay.classList.add("hidden");
  });

  // 睡眠定时器
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

  // 流结束 → 重连当前电台（B站点播的 ended 由自动连播逻辑接管）
  audio.addEventListener("ended", () => {
    if (isBiliAudio()) return;
    if (state.curStation) {
      setStatus("电台流中断，尝试重新连接...");
      attemptPlay(state.curStation, state.curIdx);
    }
  });

  // 键盘快捷键：空格播放/暂停，← → 切台
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.code === "KeyF") { fsActive ? exitFS() : enterFS(); }
    if (e.code === "Escape" && fsActive) exitFS();
    if (e.code === "ArrowLeft") isBiliAudio() ? biliSkip(-1) : playIndex(state.current - 1);
    if (e.code === "ArrowRight") isBiliAudio() ? biliSkip(1) : playIndex(state.current + 1);
    if (e.code === "ArrowUp") { e.preventDefault(); const v = Math.min(100, +els.volumeSlider.value + 5); els.volumeSlider.value = v; setVolume(v); }
    if (e.code === "ArrowDown") { e.preventDefault(); const v = Math.max(0, +els.volumeSlider.value - 5); els.volumeSlider.value = v; setVolume(v); }
  });

  /* ---------- 炫酷频谱可视化：8 种形态（主界面 / 全屏共用） ---------- */
  const viz = (() => {
    const canvas = els.vizCanvas;
    const ctx = canvas.getContext("2d");
    const N = 64;
    const bars = Array.from({ length: N }, () => ({ v: 0.08, peak: 0.08, pulse: 0 }));
    const particles = [];   // 气泡粒子池
    const ripples = [];     // 涟漪圈层
    const swarm = [];       // 星云粒子群
    const fireworks = [];   // 烟花粒子池
    const MODE_NAMES = ["条形", "气泡", "星环", "涟漪", "火苗", "星云", "螺旋", "山脉", "极光", "烟花", "雷达", "波形"];
    let mode = +(localStorage.getItem("aurora_viz_mode") ?? 1);  // 默认气泡
    let raf;

    function refreshTitles() {
      const tip = `点击切换频谱样式（当前：${MODE_NAMES[mode]}）`;
      canvas.title = tip;
      if (els.fsCanvas) els.fsCanvas.title = tip;
      if (els.fsModeLabel) els.fsModeLabel.textContent = "频谱样式：" + MODE_NAMES[mode];
    }

    function cycleMode() {
      mode = (mode + 1) % MODE_NAMES.length;
      localStorage.setItem("aurora_viz_mode", String(mode));
      particles.length = 0;
      ripples.length = 0;
      fireworks.length = 0;
      refreshTitles();
    }
    canvas.addEventListener("click", cycleMode);
    els.fsCanvas.addEventListener("click", cycleMode);
    refreshTitles();

    // 右键：直接选择任意频谱样式（不用一个个点着循环）
    let vizMenu = null;
    function hideVizMenu() { if (vizMenu) { vizMenu.remove(); vizMenu = null; } }
    function showVizMenu(x, y) {
      hideVizMenu();
      vizMenu = document.createElement("div");
      vizMenu.className = "viz-menu";
      vizMenu.innerHTML = MODE_NAMES.map((n, i) => `<button data-m="${i}"${i === mode ? ' class="on"' : ""}>${n}</button>`).join("");
      document.body.appendChild(vizMenu);
      const r = vizMenu.getBoundingClientRect();
      vizMenu.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 10)) + "px";
      vizMenu.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 10)) + "px";
      vizMenu.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-m]");
        if (!b) return;
        mode = +b.dataset.m;
        localStorage.setItem("aurora_viz_mode", String(mode));
        particles.length = 0; ripples.length = 0; fireworks.length = 0;
        refreshTitles();
        hideVizMenu();
      });
    }
    [canvas, els.fsCanvas].forEach((cv) => {
      cv.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showVizMenu(e.clientX, e.clientY);
      });
    });
    window.addEventListener("click", (e) => {
      if (vizMenu && !e.target.closest(".viz-menu")) hideVizMenu();
    });

    function roundRect(c, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function glowDot(c, x, y, r, hue, a = 0.9) {
      c.save();
      c.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
      c.shadowBlur = 10;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${hue + 20}, 100%, 85%, ${a})`);
      g.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w > 0 && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const playing = !audio.paused && state.current >= 0;
      const t = performance.now() / 1000;

      // 能量模拟：中间高两侧低的包络 + 双正弦漂移 + 快升慢降
      for (let i = 0; i < N; i++) {
        const b = bars[i];
        if (playing) {
          const env = 0.3 + 0.7 * Math.sin((i / (N - 1)) * Math.PI);
          if (Math.random() < 0.012) b.pulse = 0.3 + Math.random() * 0.5 * env;
          b.pulse *= 0.955;
          const wave = 0.22 + 0.28 * Math.sin(t * 1.05 + i * 0.22) * Math.sin(t * 0.65 + i * 0.09);
          const target = Math.min(1, Math.max(0.05, (wave + b.pulse) * env + 0.04));
          b.v += (target - b.v) * (target > b.v ? 0.22 : 0.055);
        } else {
          b.v = 0.07 + 0.05 * Math.sin(t * 1.2 + i * 0.3);
        }
      }
      const es = bars.map((b) => b.v);
      const avg = es.reduce((a, x) => a + x, 0) / N;
      render(ctx, w, h, es, t, playing, avg);

      raf = requestAnimationFrame(draw);
    }

    /* ---- 统一渲染入口（主画布与全屏画布共用） ---- */
    function render(c, w, h, es, t, playing, avg) {
      switch (mode) {
        case 0: drawBars(c, w, h, es); break;
        case 1: drawBubbles(c, w, h, es, t, playing, avg); break;
        case 2: drawOrbit(c, w, h, es, t, playing, avg); break;
        case 3: drawRipples(c, w, h, es, t, playing, avg); break;
        case 4: drawFlames(c, w, h, es, t, playing); break;
        case 5: drawNebula(c, w, h, es, t, playing); break;
        case 6: drawHelix(c, w, h, es, t, playing); break;
        case 7: drawRidges(c, w, h, es, t, playing); break;
        case 8: drawAurora(c, w, h, es, t, playing, avg); break;
        case 9: drawFireworks(c, w, h, es, t, playing, avg); break;
        case 10: drawRadar(c, w, h, es, t, playing, avg); break;
        case 11: drawWave(c, w, h, es, t, playing); break;
      }
    }

    /* ---- 0 条形：发光条 + 峰值帽 + 倒影 ---- */
    function drawBars(c, w, h, es) {
      const bw = w / N;
      const gap = Math.max(3, bw * 0.52);
      const barW = bw - gap;
      const baseY = h * 0.68;
      const maxH = h * 0.68;

      c.save();
      c.shadowColor = "rgba(124, 92, 255, 0.9)";
      c.shadowBlur = 18;
      const lg = c.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(124, 92, 255, 0)");
      lg.addColorStop(0.5, "rgba(124, 92, 255, 0.35)");
      lg.addColorStop(1, "rgba(56, 189, 248, 0)");
      c.fillStyle = lg;
      c.fillRect(w * 0.06, baseY + 1, w * 0.88, 1.5);
      c.restore();

      for (let i = 0; i < N; i++) {
        const b = bars[i];
        const bh = Math.max(3, es[i] * maxH);
        if (bh >= b.peak) b.peak = bh;
        else b.peak = Math.max(bh, b.peak - maxH * 0.006);

        const x = i * bw + gap / 2;
        const hue = 268 - (i / (N - 1)) * 92;

        c.save();
        c.shadowColor = `hsla(${hue}, 100%, 62%, 0.9)`;
        c.shadowBlur = 14;
        const g = c.createLinearGradient(0, baseY - bh, 0, baseY);
        g.addColorStop(0, `hsla(${hue + 28}, 100%, 76%, 0.98)`);
        g.addColorStop(0.55, `hsla(${hue}, 95%, 60%, 0.9)`);
        g.addColorStop(1, `hsla(${hue - 15}, 90%, 50%, 0.85)`);
        c.fillStyle = g;
        roundRect(c, x, baseY - bh, barW, bh, barW / 2);
        c.fill();
        c.restore();

        c.fillStyle = "rgba(255,255,255,0.9)";
        roundRect(c, x, baseY - b.peak - 4, barW, 2, 1);
        c.fill();

        const rh = bh * 0.4;
        const rg = c.createLinearGradient(0, baseY + 6, 0, baseY + 6 + rh);
        rg.addColorStop(0, `hsla(${hue}, 100%, 65%, 0.22)`);
        rg.addColorStop(1, `hsla(${hue}, 100%, 65%, 0)`);
        c.fillStyle = rg;
        roundRect(c, x, baseY + 6, barW, rh, barW / 2);
        c.fill();
      }
    }

    /* ---- 1 气泡：随节奏冒出、上浮、摇曳 ---- */
    function drawBubbles(c, w, h, es, t, playing, avg) {
      const baseY = h * 0.92;

      c.save();
      c.shadowColor = "rgba(124, 92, 255, 0.9)";
      c.shadowBlur = 16;
      const lg = c.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(124, 92, 255, 0)");
      lg.addColorStop(0.5, "rgba(124, 92, 255, 0.3)");
      lg.addColorStop(1, "rgba(56, 189, 248, 0)");
      c.fillStyle = lg;
      c.fillRect(w * 0.05, baseY, w * 0.9, 1.5);
      c.restore();

      if (particles.length < 90) {
        if (playing && Math.random() < 0.2 + avg * 0.55) {
          const i = Math.floor(Math.random() * N);
          const e = es[i];
          particles.push({
            x: ((i + Math.random()) / N) * w,
            y: baseY + Math.random() * 6,
            r: 2.5 + e * 9 + Math.random() * 2,
            vy: 16 + e * 55 + Math.random() * 18,
            hue: 268 - (i / N) * 92,
            wob: Math.random() * Math.PI * 2,
          });
        } else if (!playing && Math.random() < 0.04) {
          particles.push({
            x: Math.random() * w,
            y: baseY,
            r: 2 + Math.random() * 2,
            vy: 14 + Math.random() * 12,
            hue: 190 + Math.random() * 80,
            wob: Math.random() * Math.PI * 2,
          });
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y -= p.vy / 60;
        p.wob += 0.025;
        p.x += Math.sin(p.wob) * 0.45;
        if (p.y < -12) { particles.splice(i, 1); continue; }
        const fade = Math.max(0, Math.min(1, p.y / (h * 0.3)));
        c.save();
        c.globalAlpha = fade;
        c.shadowColor = `hsla(${p.hue}, 100%, 65%, 0.9)`;
        c.shadowBlur = 14;
        const g = c.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.15, p.x, p.y, p.r);
        g.addColorStop(0, `hsla(${p.hue + 25}, 100%, 88%, 0.95)`);
        g.addColorStop(0.55, `hsla(${p.hue}, 100%, 65%, 0.75)`);
        g.addColorStop(1, `hsla(${p.hue}, 100%, 55%, 0.12)`);
        c.fillStyle = g;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    /* ---- 2 星环：旋转径向光芒 ---- */
    function drawOrbit(c, w, h, es, t, playing, avg) {
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.30;
      const breathe = playing ? 1 + avg * 0.12 : 1 + 0.03 * Math.sin(t * 1.4);

      c.save();
      const coreR = R * 0.42 * breathe;
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, "rgba(180, 160, 255, 0.55)");
      cg.addColorStop(0.7, "rgba(124, 92, 255, 0.18)");
      cg.addColorStop(1, "rgba(124, 92, 255, 0)");
      c.fillStyle = cg;
      c.beginPath();
      c.arc(cx, cy, coreR, 0, Math.PI * 2);
      c.fill();
      c.restore();

      c.strokeStyle = "rgba(165, 180, 252, 0.35)";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx, cy, R * breathe, 0, Math.PI * 2);
      c.stroke();

      const spin = t * (playing ? 0.25 : 0.08);
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 + spin;
        const e = es[i];
        const len = R * (0.12 + e * 0.85);
        const hue = 268 - (i / N) * 92;
        const x1 = cx + Math.cos(angle) * (R * breathe + 2);
        const y1 = cy + Math.sin(angle) * (R * breathe + 2);
        const x2 = cx + Math.cos(angle) * (R * breathe + len);
        const y2 = cy + Math.sin(angle) * (R * breathe + len);

        c.save();
        c.strokeStyle = `hsla(${hue}, 100%, ${58 + e * 20}%, ${0.35 + e * 0.6})`;
        c.lineWidth = 2.5;
        c.lineCap = "round";
        c.shadowColor = `hsla(${hue}, 100%, 62%, 0.9)`;
        c.shadowBlur = 10;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        c.restore();

        if (e > 0.55) {
          c.fillStyle = "rgba(255,255,255,0.85)";
          c.beginPath();
          c.arc(x2, y2, 1.6, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    /* ---- 3 涟漪：能量脉冲化作扩散的声波圆环 ---- */
    function drawRipples(c, w, h, es, t, playing, avg) {
      const cx = w / 2, cy = h / 2;
      const maxR = Math.max(w, h) * 0.72;

      if (playing && Math.random() < 0.05 + avg * 0.4 && ripples.length < 24) {
        ripples.push({
          r: Math.min(w, h) * 0.03,
          a: 0.85,
          hue: 268 - Math.random() * 92,
          spd: 0.8 + Math.random() * 1.3 + avg,
        });
      } else if (!playing && Math.random() < 0.008 && ripples.length < 24) {
        ripples.push({ r: Math.min(w, h) * 0.03, a: 0.35, hue: 200 + Math.random() * 80, spd: 0.5 });
      }

      // 中心光核
      const pulse = playing ? 1 + avg * 0.35 : 1 + 0.05 * Math.sin(t * 1.5);
      const coreR = Math.min(w, h) * 0.07 * pulse;
      c.save();
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, "rgba(190, 170, 255, 0.6)");
      cg.addColorStop(1, "rgba(124, 92, 255, 0)");
      c.fillStyle = cg;
      c.beginPath();
      c.arc(cx, cy, coreR, 0, Math.PI * 2);
      c.fill();
      c.restore();

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += rp.spd * (playing ? 2.2 : 1.1);
        rp.a *= 0.985;
        if (rp.a < 0.02 || rp.r > maxR) { ripples.splice(i, 1); continue; }
        c.save();
        c.strokeStyle = `hsla(${rp.hue}, 100%, 65%, ${rp.a})`;
        c.lineWidth = 2;
        c.shadowColor = `hsla(${rp.hue}, 100%, 62%, 0.8)`;
        c.shadowBlur = 12;
        c.beginPath();
        c.arc(cx, cy, rp.r, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    }

    /* ---- 4 火苗：极光色火焰随能量摇曳 ---- */
    function drawFlames(c, w, h, es, t, playing) {
      const baseY = h * 0.96;
      const bw = w / N;
      for (let i = 0; i < N; i++) {
        const e = es[i];
        const flick = playing ? 0.8 + 0.35 * Math.abs(Math.sin(t * 2.6 + i * 1.7)) : 0.14;
        const bh = ((playing ? h * 0.12 + e * h * 0.62 : h * 0.05) * flick) + h * 0.02;
        const x = i * bw;
        const hue = 268 - (i / N) * 92;
        const tipX = x + bw / 2 + Math.sin(t * 2.2 + i * 0.9) * bw * 0.35;

        c.save();
        c.shadowColor = `hsla(${hue}, 100%, 60%, 0.85)`;
        c.shadowBlur = 16;
        const g = c.createLinearGradient(0, baseY, 0, baseY - bh);
        g.addColorStop(0, `hsla(${hue}, 95%, 60%, 0.85)`);
        g.addColorStop(0.7, `hsla(${hue + 25}, 100%, 74%, 0.7)`);
        g.addColorStop(1, `hsla(${hue + 45}, 100%, 88%, 0.03)`);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x, baseY);
        c.quadraticCurveTo(x - bw * 0.25, baseY - bh * 0.45, tipX, baseY - bh);
        c.quadraticCurveTo(x + bw * 1.25, baseY - bh * 0.45, x + bw, baseY);
        c.closePath();
        c.fill();
        c.restore();
      }
    }

    /* ---- 5 星云：旋转粒子群随能量呼吸扩散 ---- */
    function drawNebula(c, w, h, es, t, playing) {
      if (!swarm.length) {
        for (let i = 0; i < 140; i++) {
          swarm.push({
            ang: Math.random() * Math.PI * 2,
            rad: 0.15 + Math.random() * 0.85,
            spd: (0.0015 + Math.random() * 0.004) * (Math.random() < 0.5 ? 1 : -1),
            size: 1 + Math.random() * 2.4,
            hue: 190 + Math.random() * 90,
          });
        }
      }
      const cx = w / 2, cy = h / 2;
      const R0 = Math.min(w, h) * 0.42;

      // 背景星云雾
      for (let k = 0; k < 2; k++) {
        const bx = cx + Math.sin(t * 0.1 + k * 2.4) * w * 0.22;
        const by = cy + Math.cos(t * 0.08 + k * 1.7) * h * 0.2;
        const br = Math.min(w, h) * 0.5;
        const g = c.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, k === 0 ? "rgba(124, 92, 255, 0.10)" : "rgba(56, 189, 248, 0.07)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(bx, by, br, 0, Math.PI * 2);
        c.fill();
      }

      swarm.forEach((p, i) => {
        const e = es[Math.floor((i / swarm.length) * N)];
        const target = R0 * (0.2 + p.rad * 0.6) + e * R0 * 0.35;
        p.cur = (p.cur ?? target) + (target - (p.cur ?? target)) * 0.06;
        p.ang += p.spd * (playing ? 1 : 0.35);
        const x = cx + Math.cos(p.ang) * p.cur;
        const y = cy + Math.sin(p.ang) * p.cur * 0.72;
        glowDot(c, x, y, p.size + e * 2.5, p.hue, 0.35 + e * 0.55);
      });
    }

    /* ---- 6 螺旋：DNA 双螺旋随旋律扭动 ---- */
    function drawHelix(c, w, h, es, t, playing) {
      const midY = h / 2;
      const amp = h * 0.26;
      const phase = t * (playing ? 1.3 : 0.4);
      const pts1 = [], pts2 = [];

      for (let i = 0; i < N; i++) {
        const e = es[i];
        const px = (i / (N - 1)) * w;
        const hue = 268 - (i / (N - 1)) * 92;
        const y1 = midY + Math.sin(phase + i * 0.26) * amp * (0.5 + e * 0.9);
        const y2 = midY + Math.sin(phase + i * 0.26 + Math.PI) * amp * (0.5 + e * 0.9);
        pts1.push([px, y1, hue, e]);
        pts2.push([px, y2, hue, e]);

        c.strokeStyle = `hsla(${hue}, 100%, 68%, ${0.15 + e * 0.35})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(px, y1);
        c.lineTo(px, y2);
        c.stroke();
      }

      [pts1, pts2].forEach((pts) => {
        c.save();
        c.lineWidth = 2.2;
        c.lineCap = "round";
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1, hue, e] = pts[i];
          const [x2, y2] = pts[i + 1];
          c.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.4 + e * 0.5})`;
          c.shadowColor = `hsla(${hue}, 100%, 62%, 0.8)`;
          c.shadowBlur = 10;
          c.beginPath();
          c.moveTo(x1, y1);
          c.lineTo(x2, y2);
          c.stroke();
        }
        c.restore();
      });

      pts1.forEach(([x, y, hue, e], i) => {
        if (i % 2 === 0) {
          glowDot(c, x, y, 2.5 + e * 4, hue, 0.5 + e * 0.4);
          glowDot(c, x, pts2[i][1], 2.5 + e * 4, hue, 0.5 + e * 0.4);
        }
      });
    }

    /* ---- 7 山脉：层叠光脊随声浪起伏 ---- */
    function drawRidges(c, w, h, es, t, playing) {
      const LAYERS = 5;
      for (let l = 0; l < LAYERS; l++) {
        const hue = 268 - l * 14;
        const baseY = h * 0.28 + l * (h * 0.62 / LAYERS);
        const amp = h * 0.09 * (1 + l * 0.22);
        const speed = 14 + l * 9;

        c.save();
        c.beginPath();
        c.moveTo(-4, h + 4);
        for (let x = -4; x <= w + 4; x += 6) {
          const i = Math.max(0, Math.min(N - 1, Math.floor((x / w) * (N - 1))));
          const e = es[i];
          const n = Math.sin((x + t * speed) * 0.02 + l * 2.1) * Math.sin((x - t * speed * 0.6) * 0.011 + l * 1.3);
          const y = baseY - (n * 0.5 + 0.5) * amp * (0.45 + e * 1.3) - e * amp * 0.4;
          c.lineTo(x, y);
        }
        c.lineTo(w + 4, h + 4);
        c.closePath();
        c.fillStyle = "rgba(9, 12, 22, 0.88)";
        c.fill();
        c.strokeStyle = `hsla(${hue}, 100%, 70%, 0.8)`;
        c.lineWidth = 1.5;
        c.shadowColor = `hsla(${hue}, 100%, 62%, 0.9)`;
        c.shadowBlur = 9;
        c.stroke();
        c.restore();
      }
    }

    /* ---- 8 极光：多条流动光带随能量起伏 ---- */
    function drawAurora(c, w, h, es, t, playing, avg) {
      const bands = 4;
      for (let b = 0; b < bands; b++) {
        const hue = 268 - b * 30;
        const baseY = h * (0.28 + b * 0.13);
        const amp = h * (0.15 - b * 0.02) * (playing ? 1 + avg * 0.6 : 0.8);
        const spd = (playing ? 34 : 12) * (b % 2 ? 1 : -1);
        const pts = [];
        for (let x = 0; x <= w + 8; x += 8) {
          const i = Math.max(0, Math.min(N - 1, Math.floor((x / w) * (N - 1))));
          const e = es[i];
          pts.push([
            x,
            baseY + Math.sin((x + t * spd) * 0.012 + b * 1.8) * amp
                 + Math.sin((x - t * spd * 0.5) * 0.021 + b) * amp * 0.4
                 - e * amp * 0.9,
          ]);
        }
        c.save();
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = `hsla(${hue}, 100%, 75%, ${0.45 - b * 0.07})`;
        c.lineWidth = 2;
        c.lineCap = "round";
        c.shadowColor = `hsla(${hue}, 100%, 65%, 0.9)`;
        c.shadowBlur = 12;
        c.stroke();
        c.lineTo(w, h + 8);
        c.lineTo(0, h + 8);
        c.closePath();
        const g = c.createLinearGradient(0, baseY - amp * 1.4, 0, h);
        g.addColorStop(0, `hsla(${hue}, 100%, 70%, ${0.16 - b * 0.03})`);
        g.addColorStop(1, "rgba(9, 12, 22, 0)");
        c.shadowBlur = 0;
        c.fillStyle = g;
        c.fill();
        c.restore();
      }
    }

    /* ---- 9 烟花：能量脉冲发射烟花，顶点绽放 ---- */
    function drawFireworks(c, w, h, es, t, playing, avg) {
      const cx = w / 2, cy = h * 0.62;
      if (playing && fireworks.length < 180 && Math.random() < 0.05 + avg * 0.5) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const spd = h * (0.35 + Math.random() * 0.45);
        fireworks.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd * 0.35, vy: Math.sin(ang) * spd,
          hue: 268 - Math.random() * 92, size: 2 + Math.random() * 2.5,
        });
      }
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const p = fireworks[i];
        if (p.life != null) {   // 爆炸后的碎片
          p.x += p.vx / 60; p.y += p.vy / 60;
          p.vy += 10; p.vx *= 0.99; p.life *= 0.965;
          if (p.life < 0.03 || p.y > h + 20) { fireworks.splice(i, 1); continue; }
          glowDot(c, p.x, p.y, p.size * p.life + 1, p.hue, p.life);
        } else {                // 上升的火箭
          p.x += p.vx / 60; p.y += p.vy / 60; p.vy += 14;
          if (p.vy > -14 || p.y < h * 0.08) {   // 到达顶点 → 绽放
            const n = 26 + Math.floor(Math.random() * 18);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2;
              const s = 90 + Math.random() * 120 + es[Math.floor(Math.random() * N)] * 120;
              fireworks.push({
                x: p.x, y: p.y,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                hue: p.hue + Math.random() * 40 - 20,
                life: 1, size: p.size * 0.8,
              });
            }
            fireworks.splice(i, 1);
            continue;
          }
          c.save();
          c.shadowColor = `hsla(${p.hue}, 100%, 70%, 1)`;
          c.shadowBlur = 12;
          c.strokeStyle = `hsla(${p.hue}, 100%, 80%, 0.9)`;
          c.lineWidth = p.size * 0.8;
          c.lineCap = "round";
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx / 40, p.y - p.vy / 40);
          c.stroke();
          c.restore();
        }
      }
      // 地平线
      c.save();
      const lg = c.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(124, 92, 255, 0)");
      lg.addColorStop(0.5, "rgba(124, 92, 255, 0.3)");
      lg.addColorStop(1, "rgba(56, 189, 248, 0)");
      c.fillStyle = lg;
      c.fillRect(w * 0.05, cy, w * 0.9, 1.5);
      c.restore();
    }

    /* ---- 10 雷达：上下镜像环形频谱 + 旋转扫描线 ---- */
    function drawRadar(c, w, h, es, t, playing, avg) {
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.34;
      const spin = t * (playing ? 0.9 : 0.2);
      c.save();
      c.strokeStyle = "rgba(165, 180, 252, 0.30)";
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R * 1.28, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, R * 0.62, 0, Math.PI * 2); c.stroke();
      c.restore();
      for (let i = 0; i < N; i++) {
        const e = es[i];
        const ang = (i / N) * Math.PI * 2;
        const len = R * (0.10 + e * 0.95);
        const hue = 268 - (i / N) * 92;
        for (const sgn of [1, -1]) {
          const a = ang * sgn + spin;
          const x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R;
          const x2 = cx + Math.cos(a) * (R + len), y2 = cy + Math.sin(a) * (R + len);
          c.save();
          c.strokeStyle = `hsla(${hue}, 100%, ${58 + e * 20}%, ${0.35 + e * 0.6})`;
          c.lineWidth = 3;
          c.lineCap = "round";
          c.shadowColor = `hsla(${hue}, 100%, 62%, 0.9)`;
          c.shadowBlur = 10;
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          c.restore();
        }
      }
      c.save();
      const sa = spin * 1.6;
      const g = c.createLinearGradient(cx, cy, cx + Math.cos(sa) * R * 1.28, cy + Math.sin(sa) * R * 1.28);
      g.addColorStop(0, "rgba(124, 92, 255, 0)");
      g.addColorStop(1, "rgba(124, 92, 255, 0.55)");
      c.strokeStyle = g;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(sa) * R * 1.28, cy + Math.sin(sa) * R * 1.28);
      c.stroke();
      const coreR = R * 0.18 * (playing ? 1 + avg * 0.5 : 1);
      const cg = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, "rgba(190, 170, 255, 0.5)");
      cg.addColorStop(1, "rgba(124, 92, 255, 0)");
      c.fillStyle = cg;
      c.beginPath(); c.arc(cx, cy, coreR, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    /* ---- 11 波形：示波器三重曲线 + 刻度网格 ---- */
    function drawWave(c, w, h, es, t, playing) {
      const midY = h / 2;
      const amp = h * 0.34;
      c.save();
      c.strokeStyle = "rgba(148, 163, 184, 0.12)";
      c.lineWidth = 1;
      for (let k = 1; k <= 3; k++) {
        const y = (h / 4) * k;
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      }
      for (let k = 1; k <= 5; k++) {
        const x = (w / 6) * k;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
      }
      c.restore();
      const drawLine = (phase, hueBase, alpha, width) => {
        c.save();
        c.beginPath();
        for (let i = 0; i < N; i++) {
          const e = es[i];
          const x = (i / (N - 1)) * w;
          const y = midY + Math.sin(i * 0.55 + phase + t * (playing ? 3 : 0.6)) * amp * (0.15 + e * 1.1);
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.strokeStyle = `hsla(${hueBase}, 100%, 70%, ${alpha})`;
        c.lineWidth = width;
        c.lineCap = "round";
        c.lineJoin = "round";
        c.shadowColor = `hsla(${hueBase}, 100%, 62%, 0.9)`;
        c.shadowBlur = 14;
        c.stroke();
        c.restore();
      };
      drawLine(0, 268, 0.9, 2.4);
      drawLine(Math.PI * 0.66, 240, 0.45, 1.6);
      drawLine(Math.PI * 1.33, 200, 0.3, 1.2);
      c.save();
      const lg = c.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(124, 92, 255, 0)");
      lg.addColorStop(0.5, "rgba(124, 92, 255, 0.35)");
      lg.addColorStop(1, "rgba(56, 189, 248, 0)");
      c.fillStyle = lg;
      c.fillRect(0, midY - 0.75, w, 1.5);
      c.restore();
    }

    draw();
    return {
      stop: () => cancelAnimationFrame(raf),
      energies: () => bars.map((b) => b.v),
      render,
    };
  })();

  /* ---------- 自定义标题栏：窗口控制 ---------- */
  if (window.aurora) {
    $("winMin").addEventListener("click", () => window.aurora.minimize());
    $("winMax").addEventListener("click", () => window.aurora.toggleMaximize());
    $("winClose").addEventListener("click", () => window.aurora.close());
    els.winMini.addEventListener("click", () => window.aurora.miniMode());
    window.aurora.onMaximizeChange((max) => document.body.classList.toggle("maximized", max));
    els.titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".tb-btn")) return;
      window.aurora.toggleMaximize();
    });

    // 悬浮球迷你窗口：把当前播放信息推给小球，并响应小球发来的控制指令
    if (window.aurora.onMiniCmd) {
      window.aurora.onMiniCmd((cmd) => {
        if (cmd === "togglePlay") togglePlay();
        else if (cmd === "prev") isBiliAudio() ? biliSkip(-1) : playIndex(state.current - 1);
        else if (cmd === "next") isBiliAudio() ? biliSkip(1) : playIndex(state.current + 1);
        else if (cmd === "info") pushMiniInfo();
      });
    }
  } else {
    document.querySelector(".tb-controls").classList.add("hidden");
    document.body.classList.add("no-room"); // 移动端无本机弹幕服务，隐藏相关入口
  }

  // 推送播放状态到悬浮球（标题 / 是否在播放）
  function pushMiniInfo() {
    if (!window.aurora || !window.aurora.sendMiniInfo) return;
    window.aurora.sendMiniInfo({
      title: (state.curStation && state.curStation.name) || "Aurora FM",
      playing: !audio.paused && !!audio.src,
    });
  }

  /* ---------- 全屏屏保模式 ---------- */
  let fsActive = false;

  function updateFSMeta(s) {
    if (!s || !s.name) return;
    els.fsName.textContent = s.name;
    els.fsInfo.textContent = `${flagFull(s.countrycode)} ${s.country || "未知地区"} · ${s.bitrate || "?"} kbps`;
    els.fsTags.innerHTML = (s.tags || "")
      .split(",").filter(Boolean).slice(0, 5)
      .map((t) => `<span class="tag">${escapeHtml(t.trim())}</span>`).join("");
  }

  function enterFS() {
    fsActive = true;
    els.fsOverlay.classList.remove("hidden");
    updateFSMeta(state.curStation);
    if (window.aurora) window.aurora.setFullscreen(true);
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function exitFS() {
    fsActive = false;
    els.fsOverlay.classList.add("hidden");
    if (window.aurora) window.aurora.setFullscreen(false);
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  els.fsBtn.addEventListener("click", enterFS);
  els.fsExit.addEventListener("click", exitFS);
  els.fsPrev.addEventListener("click", () => playIndex(state.curIdx - 1));
  els.fsNext.addEventListener("click", () => playIndex(state.curIdx + 1));
  els.fsPlay.addEventListener("click", togglePlay);

  // 屏保时钟
  function fsTick() {
    const d = new Date();
    els.fsClock.textContent =
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    els.fsDate.textContent =
      `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${"日一二三四五六"[d.getDay()]}`;
  }
  fsTick();
  setInterval(fsTick, 1000);

  // 屏保频谱：复用主频谱能量与 8 种形态渲染（点击画布切换样式）
  (() => {
    const canvas = els.fsCanvas;
    const ctx = canvas.getContext("2d");
    function draw() {
      requestAnimationFrame(draw);
      if (els.fsOverlay.classList.contains("hidden")) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w > 0 && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const es = viz.energies();
      const avg = es.reduce((a, x) => a + x, 0) / es.length;
      const playing = !audio.paused && state.current >= 0;
      viz.render(ctx, w, h, es, performance.now() / 1000, playing, avg);
    }
    draw();
  })();

  /* ---------- 同频道弹幕房间（公共云端中继：跨机器 / 跨网络互通） ---------- */
  const room = (() => {
    // 金庸武侠角色随机昵称
    const NICKS = [
      "令狐冲","任盈盈","风清扬","东方不败","杨过","小龙女","郭靖","黄蓉",
      "张无忌","赵敏","周芷若","小昭","殷离","乔峰","萧峰","段誉","王语嫣",
      "虚竹","梦姑","木婉清","钟灵","阿朱","阿紫","慕容复","韦小宝","双儿",
      "阿珂","苏荃","曾柔","方怡","沐剑屏","建宁公主","陈近南","九难",
      "袁承志","温青青","夏青青","阿九","胡斐","程灵素","苗若兰","袁紫衣",
      "狄云","水笙","戚芳","石破天","丁珰","白自在","张三丰","宋远桥",
      "俞莲舟","殷素素","谢逊","杨逍","范遥","殷天正","韦一笑","周伯通",
      "黄药师","欧阳锋","一灯大师","洪七公","梅超风","穆念慈","杨康",
      "郭襄","郭芙","陆无双","程英","公孙绿萼","李莫愁","丘处机",
      "岳灵珊","林平之","仪琳","田伯光","任我行","向问天","左冷禅",
      "岳不群","宁中则","天山童姥","李秋水","鸠摩智","段正淳","刀白凤",
      "阮星竹","甘宝宝","秦红棉","王夫人","康敏","游坦之","丁春秋",
      "陈家洛","霍青桐","香香公主","无尘道长","赵半山","文泰来","骆冰",
      "余鱼同","李沅芷","苗人凤","田归农","胡一刀","王难姑",
    ];
    const rnd = (n) => Math.floor(Math.random() * n);
    const myId = Math.random().toString(36).slice(2) + Date.now().toString(36);

    let myName = localStorage.getItem("aurora_nick") || NICKS[rnd(NICKS.length)];
    localStorage.setItem("aurora_nick", myName);

    // 公共 MQTT-over-WSS 中继：无需部署服务器、无需登录，天然跨公网。
    // 多个候选，连不上自动切换；用户也可在设置面板里填自建服务。
    const PUBLIC_RELAYS = [
      "wss://broker.emqx.io:8084/mqtt",
      "wss://test.mosquitto.org:8081/mqtt",
    ];
    const NS = "aurora-fm/v1";          // 主题命名空间，避免与公共 broker 上其他人冲突
    const PRESENCE_MS = 5000;           // 心跳间隔
    const PEER_TTL = 16000;             // 超过该时长没心跳视为离线

    let cfg = loadCfg();
    let wantedRoom = null;   // 期望加入的电台频道（stationuuid）
    let retryTimer = null;
    let dead = false;        // 程序退出标记

    let mqtt = null;         // 云端中继连接
    let ws = null;           // 本机 / 局域网直连连接
    let mode = "offline";    // cloud | lan | offline
    let subRoom = null;      // 当前已订阅的频道
    let connTimer = null;    // 连接超时守护

    const peers = new Map();  // id -> { name, ts }：云端模式下由心跳统计在线人数

    function loadCfg() {
      let group = "", server = "";
      try {
        group = localStorage.getItem("aurora_room_group") || "";
        server = localStorage.getItem("aurora_room_server") || "";
      } catch (_) { /* ignore */ }
      return { group: sanitize(group) || "public", server: server.trim() };
    }
    function saveCfg(c) {
      try {
        localStorage.setItem("aurora_room_group", c.group);
        localStorage.setItem("aurora_room_server", c.server);
      } catch (_) { /* ignore */ }
    }
    function sanitize(s, max = 24) {
      return String(s || "").replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, "").slice(0, max) || "public";
    }
    function topicBase(roomId) {
      return `${NS}/${sanitize(cfg.group)}/${sanitize(roomId, 64)}`;
    }

    // 连接状态：始终显示徽标，让用户知道在线服务到底起没起来
    function setLinkState(text, cls, title) {
      const el = els.roomCount;
      el.textContent = text;
      el.className = "room-count " + (cls || "");
      el.title = title || "点击查看 / 设置联机频道";
      el.classList.remove("hidden");
    }
    function updateCount(n) {
      if (mode === "offline") return;
      const label = mode === "lan" ? "📶" : "☁";
      setLinkState(`${label} 在线 ${n} 人`, "room-online",
        mode === "lan" ? "已连接局域网 / 本机服务" : "已连接云端中继 · 跨网络同频道互通");
    }
    function setConnecting() {
      setLinkState("🔄 联机中…", "room-connecting", "正在连接弹幕中继，请稍候");
    }
    function setOffline() {
      setLinkState("⚠ 未连接", "room-offline", "在线服务未连接，点此查看设置 / 重试");
    }

    // 漂浮弹幕：随机泳道 + 按昵称染色的渐变文字
    function spawnDanmaku(name, text, mine) {
      const layer = els.danmakuLayer;
      if (layer.children.length > 14) layer.firstElementChild?.remove();
      const el = document.createElement("div");
      el.className = "dm-item" + (mine ? " mine" : "");
      const hue = [...(name || "侠")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
      el.style.setProperty("--dm-hue", hue);
      el.style.top = (6 + Math.random() * 76) + "%";
      el.style.animationDuration = 9 + Math.random() * 5 + Math.min(6, (text || "").length * 0.08) + "s";
      el.innerHTML = `<b>${escapeHtml(name || "侠客")}</b>${escapeHtml(text)}`;
      el.addEventListener("animationend", () => el.remove());
      layer.appendChild(el);
    }

    // 系统提示：右侧淡入淡出，不占用泳道
    function spawnSys(text) {
      const el = document.createElement("div");
      el.className = "dm-sys";
      el.textContent = text;
      els.danmakuLayer.appendChild(el);
      setTimeout(() => el.remove(), 3600);
    }

    function handleMessage(m) {
      if (m.type === "count") updateCount(m.n);
      else if (m.type === "chat") spawnDanmaku(m.name, m.text, m.id === myId);
      else if (m.type === "sys") spawnSys(m.text);
    }

    let gen = 0;                 // 连接代次：避免旧连接的回调干扰新连接
    let presenceTimer = null;
    let sweepTimer = null;

    /* ---- 云端：按主题收发，presence 心跳统计在线人数 ---- */
    function cloudPublish(kind, payload) {
      if (!mqtt || !mqtt.isConnected() || !subRoom) return false;
      return mqtt.publish(
        `${topicBase(subRoom)}/${kind}`,
        Object.assign({ id: myId, name: myName }, payload || {})
      );
    }
    function sendPresence() { cloudPublish("presence", { ts: Date.now() }); }

    function startCloudTimers() {
      stopCloudTimers();
      presenceTimer = setInterval(sendPresence, PRESENCE_MS);
      sweepTimer = setInterval(refreshCloudCount, 4000);
    }
    function stopCloudTimers() {
      if (presenceTimer) clearInterval(presenceTimer);
      if (sweepTimer) clearInterval(sweepTimer);
      presenceTimer = sweepTimer = null;
    }
    function refreshCloudCount() {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of peers) {
        if (now - p.ts > PEER_TTL) {
          peers.delete(id);
          changed = true;
          spawnSys(`${p.name} 离开了`);
        }
      }
      if (changed) updateCount(peers.size + 1);
    }
    function onCloudTopic(topic, payload) {
      let m;
      try { m = JSON.parse(payload); } catch (_) { return; }
      const kind = topic.split("/").pop();
      if (kind === "chat") {
        // 自己发的已本地即时显示，忽略 broker 回环，避免重复
        if (m.id === myId) return;
        handleMessage({ type: "chat", id: m.id, name: m.name, text: m.text });
      } else if (kind === "presence") {
        if (!m.id || m.id === myId) return;
        const isNew = !peers.has(m.id);
        peers.set(m.id, { name: m.name || "侠客", ts: Date.now() });
        if (isNew) {
          spawnSys(`${m.name || "侠客"} 进入了电台`);
          sendPresence();          // 回一声，让对方立刻把我算进在线人数
        }
        updateCount(peers.size + 1);
      } else if (kind === "sys") {
        handleMessage({ type: "sys", text: m.text });
      }
    }

    /* ---- 建立云端中继连接（多个候选依次尝试） ---- */
    function connectCloud(urls, attempt, myGen) {
      if (dead || myGen !== gen) return;
      if (!window.AuroraMQTT) { fallbackLan(myGen); return; }
      if (attempt >= urls.length) { fallbackLan(myGen); return; }

      setConnecting();
      const url = urls[attempt];
      let settled = false;
      const guard = setTimeout(() => {
        if (settled || myGen !== gen) return;
        settled = true;
        try { mqtt && mqtt.end(); } catch (_) { /* ignore */ }
        mqtt = null;
        connectCloud(urls, attempt + 1, myGen);   // 超时换下一个中继
      }, 9000);

      try {
        mqtt = window.AuroraMQTT.create(url, {
          clientId: myId,
          onOpen: () => {
            if (dead || myGen !== gen) return;
            settled = true;
            clearTimeout(guard);
            mode = "cloud";
            subRoom = wantedRoom;
            mqtt.subscribe(`${topicBase(subRoom)}/#`);
            peers.clear();
            updateCount(1);
            sendPresence();
            startCloudTimers();
          },
          onMessage: (t, p) => { if (!dead && myGen === gen) onCloudTopic(t, p); },
          onClose: () => {
            clearTimeout(guard);
            if (dead || myGen !== gen) return;
            if (!settled) { connectCloud(urls, attempt + 1, myGen); return; }
            stopCloudTimers();
            mqtt = null;
            mode = "offline";
            setOffline();
            scheduleRetry();
          },
        });
      } catch (_) {
        clearTimeout(guard);
        connectCloud(urls, attempt + 1, myGen);
      }
    }

    /* ---- 兜底：本机 / 局域网 WebSocket 服务 ---- */
    function connectLan(url, myGen) {
      if (dead || myGen !== gen) return;
      setConnecting();
      try { ws = new WebSocket(url); } catch (_) { lanFailed(myGen); return; }
      const guard = setTimeout(() => { if (ws && ws.readyState !== 1) lanFailed(myGen); }, 8000);
      ws.onopen = () => {
        clearTimeout(guard);
        if (dead || myGen !== gen) return;
        mode = "lan";
        subRoom = wantedRoom;
        try { ws.send(JSON.stringify({ type: "join", room: subRoom, name: myName, id: myId })); } catch (_) {}
      };
      ws.onmessage = (e) => {
        try { handleMessage(JSON.parse(e.data)); } catch (_) { /* ignore */ }
      };
      ws.onclose = () => {
        clearTimeout(guard);
        ws = null;
        lanFailed(myGen);
      };
      ws.onerror = () => { try { ws && ws.close(); } catch (_) { /* ignore */ } };
    }
    function lanFailed(myGen) {
      if (dead || myGen !== gen) return;
      ws = null;
      mode = "offline";
      setOffline();
      scheduleRetry();
    }
    async function fallbackLan(myGen) {
      if (dead || myGen !== gen) return;
      if (!window.aurora || !window.aurora.roomPort) { setOffline(); scheduleRetry(); return; }
      let port = 0;
      try { port = await window.aurora.roomPort(); } catch (_) { /* ignore */ }
      if (dead || myGen !== gen) return;
      if (!port) { setOffline(); scheduleRetry(); return; }
      connectLan(`ws://127.0.0.1:${port}`, myGen);
    }

    function teardown(bump = true) {
      if (bump) gen++;
      stopCloudTimers();
      if (connTimer) { clearTimeout(connTimer); connTimer = null; }
      if (mqtt) { try { mqtt.end(); } catch (_) { /* ignore */ } mqtt = null; }
      if (ws) {
        try { ws.onclose = ws.onerror = null; ws.close(); } catch (_) { /* ignore */ }
        ws = null;
      }
      peers.clear();
      subRoom = null;
      mode = "offline";
    }

    function startConnect() {
      if (!wantedRoom || dead) return;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      teardown(true);
      const myGen = gen;
      const server = cfg.server;
      if (server.toLowerCase().startsWith("ws://")) { connectLan(server, myGen); return; }
      connectCloud(server ? [server] : PUBLIC_RELAYS, 0, myGen);
    }

    function scheduleRetry() {
      if (retryTimer || dead) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (wantedRoom) startConnect();
      }, 6000);
    }

    function join(stationuuid) {
      if (!stationuuid || dead) return;
      const changed = wantedRoom !== stationuuid;
      wantedRoom = stationuuid;
      if (!changed && mode !== "offline") return;   // 同频道且已连接

      if (mode === "cloud" && mqtt && mqtt.isConnected()) {
        if (subRoom) mqtt.unsubscribe(`${topicBase(subRoom)}/#`);
        subRoom = wantedRoom;
        mqtt.subscribe(`${topicBase(subRoom)}/#`);
        peers.clear();
        updateCount(1);
        sendPresence();
        return;
      }
      if (mode === "lan" && ws && ws.readyState === 1) {
        subRoom = wantedRoom;
        try { ws.send(JSON.stringify({ type: "join", room: subRoom, name: myName, id: myId })); } catch (_) {}
        return;
      }
      startConnect();
    }

    function send(text) {
      text = (text || "").trim().slice(0, 60);
      if (!text) return false;
      if (mode === "cloud" && mqtt && mqtt.isConnected()) {
        spawnDanmaku(myName, text, true);          // 本地即时显示
        cloudPublish("chat", { text });
        return true;
      }
      if (mode === "lan" && ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify({ type: "chat", text })); return true; } catch (_) { return false; }
      }
      return false;
    }

    function changeName() {
      myName = NICKS[rnd(NICKS.length)];
      localStorage.setItem("aurora_nick", myName);
      els.dmNick.textContent = myName + "▾";
      spawnSys(`大侠重新出道，你现在是「${myName}」`);
      if (mode === "cloud") sendPresence();
      else if (mode === "lan" && ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify({ type: "join", room: subRoom, name: myName, id: myId })); } catch (_) {}
      }
    }

    function reconfigure(group, server) {
      cfg = { group: sanitize(group) || "public", server: (server || "").trim() };
      saveCfg(cfg);
      if (wantedRoom) startConnect();
      return cfg;
    }

    function leave() {
      dead = true;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      teardown();
      wantedRoom = null;
      setOffline();
    }

    els.dmNick.textContent = myName + "▾";
    const api = {
      join, send, leave, changeName, reconfigure,
      getCfg: () => ({ group: cfg.group, server: cfg.server }),
      retryNow: () => { if (wantedRoom) startConnect(); },
    };
    window.__auroraRoom = api;   // 只读联机接口，便于诊断 / 自动化验证
    return api;
  })();

  function submitDanmaku() {
    const text = els.danmakuInput.value.trim();
    if (!text) return;
    if (room.send(text)) {
      els.danmakuInput.value = "";
    } else {
      setStatus("在线服务未连接，点右上角「未连接」徽标可查看状态 / 重试", "error");
    }
  }
  els.danmakuSend.addEventListener("click", submitDanmaku);
  els.danmakuInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitDanmaku();
  });
  els.dmNick.addEventListener("click", () => room.changeName());

  /* ---------- 联机频道设置面板 ---------- */
  async function openRoomPanel() {
    const c = room.getCfg();
    els.roomGroupInput.value = c.group === "public" ? "" : c.group;
    els.roomServerInput.value = c.server;
    els.roomPanel.classList.remove("hidden");
    // 展示本机局域网直连地址，供同网段其他电脑填写
    if (window.aurora && window.aurora.roomLanIps && window.aurora.roomPort) {
      try {
        const [ips, port] = await Promise.all([window.aurora.roomLanIps(), window.aurora.roomPort()]);
        if (ips && ips.length && port) {
          els.roomLanHint.textContent = " 本机直连地址：" +
            ips.map((ip) => `ws://${ip}:${port}`).join(" 或 ") +
            "（同一局域网的其他电脑填这个即可）";
        }
      } catch (_) { /* ignore */ }
    }
  }
  els.roomCount.addEventListener("click", openRoomPanel);
  els.roomPanelClose.addEventListener("click", () => els.roomPanel.classList.add("hidden"));
  els.roomPanelSave.addEventListener("click", () => {
    room.reconfigure(els.roomGroupInput.value, els.roomServerInput.value);
    els.roomPanel.classList.add("hidden");
    setStatus("联机设置已保存，正在重新连接…", "ok");
  });
  els.roomPanelReset.addEventListener("click", () => {
    els.roomGroupInput.value = "";
    els.roomServerInput.value = "";
    room.reconfigure("", "");
    els.roomPanel.classList.add("hidden");
    setStatus("已恢复默认云端中继", "ok");
  });

  /* ---------- 哔哩哔哩电台：搜索视频，仅播放音频 ---------- */
  const bili = { keyword: "", page: 1, items: [], loading: false, current: null, mode: "video", authors: [], curAuthor: null, sort: "totalrank", auto: true, podResults: [], podEps: [], podView: "search" };
  const PAGE_COUNT = 20;

  function fmtDur(sec) {
    sec = Math.max(0, +sec || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  function fmtPlay(n) {
    n = +n || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(1) + "亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
    return String(n);
  }
  function fmtDate(sec) {
    const d = new Date((+sec || 0) * 1000);
    if (isNaN(d.getTime()) || !+sec) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function openBiliPanel() {
    els.biliPanel.classList.remove("hidden");
    els.biliSearchInput.focus();
    // 默认推荐：面板第一次打开且没有任何结果时，自动搜一个随机分类，不空屏
    if (!bili.keyword && !bili.items.length && !bili.podResults.length && !bili.authors.length && !bili.loading) {
      biliSearchCategory(null, true);
    }
  }
  els.biliPanelClose.addEventListener("click", () => els.biliPanel.classList.add("hidden"));
  els.biliSearchBtn.addEventListener("click", () => biliSearch(true));
  els.biliSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") biliSearch(true);
  });

  // 搜索模式切换：搜视频 / 搜博主 / 播客
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
    // 播客模式没有「综合/最新」排序（RSS 天然按发布时间排）
    const isPod = mode === "podcast";
    els.biliSortDefault.classList.toggle("hidden", isPod);
    els.biliSortNew.classList.toggle("hidden", isPod);
    if (isPod) renderBiliPodcast();
  }
  els.biliModeVideo.addEventListener("click", () => setBiliMode("video"));
  els.biliModeAuthor.addEventListener("click", () => setBiliMode("author"));
  els.biliModePod.addEventListener("click", () => setBiliMode("podcast"));

  /* ---------- 分类推荐子标签栏：科技 / 新闻 / 哲学 / 有趣 ... ---------- */
  // 每个分类一组精选关键词（播客单独一组，适配 Apple 播客生态），点击随机抽一个直接搜
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
    // 播客模式优先用上次选的分类；自动触发时按当前模式抽默认分类
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
  // 右键自定义槽位：清空该槽
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

  /* ---- 自定义快捷分类：3 个槽位（与 9 个内置分类同排两行），点击即搜，localStorage 持久化 ---- */
  const CUSTOM_CAT_COUNT = 3;
  const BUILTIN_CAT_KEYS = Array.from(document.querySelectorAll("#biliCatChips .bili-cat:not(.bili-cat-custom)")).map((el) => el.dataset.cat);
  document.querySelectorAll("#biliCatChips .bili-cat:not(.bili-cat-custom)").forEach((el) => (el.draggable = true));
  let customCats;
  try { customCats = JSON.parse(localStorage.getItem("aurora_bili_custom") || "null") || []; }
  catch (_) { customCats = []; }
  while (customCats.length < CUSTOM_CAT_COUNT) customCats.push(null);
  if (customCats.length > CUSTOM_CAT_COUNT) customCats.length = CUSTOM_CAT_COUNT;   // 旧版 4 槽数据兼容
  function saveCustomCats() { localStorage.setItem("aurora_bili_custom", JSON.stringify(customCats)); }

  /* ---- 分类顺序：支持拖动排序，保存后下次打开保持上次顺序 ---- */
  const CAT_ORDER_KEY = "aurora_bili_cat_order";
  let catOrder;
  try {
    const savedOrder = JSON.parse(localStorage.getItem(CAT_ORDER_KEY) || "null");
    catOrder = Array.isArray(savedOrder)
      ? savedOrder.filter((k) => BUILTIN_CAT_KEYS.includes(k) || /^custom-\d+$/.test(k))
      : [];
  } catch (_) { catOrder = []; }
  // 补齐缺失项（新版新增分类 / 首次使用），缺失的内置在前、自定义槽在后
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
  // 按 catOrder 排列全部 chip（内置节点移动复用，自定义槽重建）
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
  function renderCustomCats() { layoutCatChips(); }   // 兼容旧调用

  /* ---- 点击自定义槽：空槽把搜索框里的原样内容存为快捷分类；已存槽单击即搜 ---- */
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

  /* ---- 分类拖动排序（HTML5 Drag & Drop） ---- */
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
    catOrder.splice(to + (from > to ? 0 : 1), 0, key);   // 从右往左拖插到目标前，从左往右拖插到目标后
    saveCatOrder();
    layoutCatChips();
    setStatus("分类顺序已保存，下次打开保持此排列", "ok");
  });
  els.biliCatChips.addEventListener("dragend", () => {
    dragCatKey = null;
    els.biliCatChips.querySelectorAll(".dragging-chip,.drag-over").forEach((c) => c.classList.remove("dragging-chip", "drag-over"));
  });
  renderCustomCats();

  /* ---- 搜索历史：最近 5 条，点击即搜 ---- */
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
    markCatChip(null);   // 历史搜索不属于任何分类，清除高亮
    biliSearch(true);
  });
  els.biliHistClear.addEventListener("click", () => {
    biliHistory = [];
    saveBiliHistory();
    renderBiliHistory();
    setStatus("已清空搜索历史");
  });
  renderBiliHistory();

  // 排序切换：综合（相关度）/ 最新（发布时间）
  function setBiliSort(ord) {
    bili.sort = ord;
    els.biliSortDefault.classList.toggle("on", ord === "totalrank");
    els.biliSortNew.classList.toggle("on", ord === "pubdate");
    if (bili.keyword) biliSearch(true);
  }
  els.biliSortDefault.addEventListener("click", () => setBiliSort("totalrank"));
  els.biliSortNew.addEventListener("click", () => setBiliSort("pubdate"));

  // 自动连播开关
  els.biliAutoBtn.addEventListener("click", () => {
    bili.auto = !bili.auto;
    els.biliAutoBtn.classList.toggle("on", bili.auto);
    setStatus(bili.auto ? "已开启自动连播：播完自动播下一个节目" : "已关闭自动连播");
  });

  async function biliSearch(reset) {
    const kw = els.biliSearchInput.value.trim();
    if (!kw) { setStatus("请输入搜索关键词", "error"); return; }
    if (reset) pushBiliHistory(kw);   // 记入最近搜索（保留 5 条）
    if (!window.aurora || !window.aurora.biliSearch) {
      setStatus("当前环境不支持搜索（需桌面版）", "error");
      return;
    }
    // 播客模式：走 iTunes 公开搜索接口
    if (bili.mode === "podcast") {
      if (!window.aurora.podcastSearch) { setStatus("当前环境不支持播客搜索（需桌面版）", "error"); return; }
      if (bili.loading) return;
      bili.loading = true;
      renderBiliLoading();
      try {
        const r = await window.aurora.podcastSearch(kw);
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
      const r = await window.aurora.biliSearch(bili.keyword, bili.page, bili.mode, bili.sort);
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

  // 博主模式：顶部博主胶囊 + 当前博主的视频列表
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

  /* 播客模式：搜索结果（节目列表）↔ 单集列表 */
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

  /* ---------- 点播收藏夹 + 顶部置顶栏（B站视频 / 播客节目 / 播客单集） ---------- */
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
  // 5 个固定格子：已置顶的显示封面+简称，其余为空格子
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
    renderVodPins();          // 内部统一持久化
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
  // 收藏的播客节目：拉 RSS 单集 → 播放最新一集，并把列表载入播客视图
  async function loadAndPlayPod(p) {
    if (!window.aurora || !window.aurora.podcastEpisodes) { setStatus("当前环境不支持播客（需桌面版）", "error"); return; }
    setStatus("正在打开收藏的播客…");
    try {
      const r = await window.aurora.podcastEpisodes(p.feedUrl, p);
      bili.podEps = r.episodes || [];
      if (!bili.podResults.some((x) => vodKeyOf("pod", x) === vodKeyOf("pod", p))) bili.podResults.unshift(p);
      bili.podView = "episodes";
      setBiliMode("podcast");           // 会按 podView 渲染单集列表
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

  // 置顶栏：点击播放、右键/小× 取消置顶、空格子打开收藏夹
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
  // 收藏夹面板：点行播放，📌 置顶，🗑 删除
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
  renderVodPins();   // 启动时把上次的置顶项还原到顶栏

  els.biliResults.addEventListener("click", async (e) => {
    // 收藏星标：优先处理，不触发播放
    const star = e.target.closest(".vod-fav-star");
    if (star) {
      const it = vodListByType(star.dataset.vodtype)[+star.dataset.vodi];
      if (it) toggleVodFavByItem(star.dataset.vodtype, it, star.dataset.key);
      return;
    }
    // 播客：返回节目列表
    if (e.target.closest(".pod-back")) {
      bili.podView = "search";
      renderBiliPodcast();
      return;
    }
    const item = e.target.closest(".bili-item");
    if (!item) return;
    // 播客：点节目 → 拉取单集
    if (item.dataset.kind === "pod") {
      const p = bili.podResults[+item.dataset.i];
      if (!p || !window.aurora || !window.aurora.podcastEpisodes) return;
      setStatus("正在拉取播客单集…");
      try {
        const r = await window.aurora.podcastEpisodes(p.feedUrl, p);
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
    // 播客：点单集 → 直接播放
    if (item.dataset.kind === "pod-ep") {
      const ep = bili.podEps[+item.dataset.i];
      if (ep) playBili(ep, 1);
      return;
    }
    // B站：根据当前模式找到对应的数据项
    const list = bili.mode === "author"
      ? ((bili.authors.find((a) => a.author === bili.curAuthor) || {}).items || [])
      : bili.items;
    const it = list[+item.dataset.i];
    if (it) playBili(it, 1);
  });

  els.biliPageSel.addEventListener("change", () => {
    if (bili.current) playBili(bili.current.item, +els.biliPageSel.value);
  });

  // 自动连播：B站/播客点播播完（或分P播完）后，按列表顺序自动播下一个
  function biliCurrentList() {
    if (bili.mode === "podcast") return bili.podEps || [];
    return bili.mode === "author"
      ? ((bili.authors.find((a) => a.author === bili.curAuthor) || {}).items || [])
      : bili.items;
  }
  // 列表项唯一键：播客用音频直链，B站用 bvid
  function vodKey(x) { return x.kind === "podcast" ? x.enclosure : x.bvid; }
  function biliNextTarget() {
    if (!bili.current) return null;
    const { item, info } = bili.current;
    // 同一视频还有下一P：先连播下一P
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
        // 播客单集：enclosure 直链经本地 bilaudio:// 代理（支持 Range 断点续播）
        r = {
          title: item.title,
          author: item.artist || item.podTitle || "",
          pic: item.pic,
          duration: item.duration || 0,
          pages: [],
          page: 1,
          stream: "bilaudio://play/?u=" + encodeURIComponent(item.enclosure),
        };
      } else {
        if (!window.aurora || !window.aurora.biliResolve) return;
        setStatus("正在解析 B 站音频流…");
        r = await window.aurora.biliResolve(item.bvid, page);
      }
      bili.current = { kind: isPod ? "podcast" : "bili", item, info: r };
      if (isPod) {
        recordHistory({ type: "pod", ep: item });
      } else {
        recordHistory({ type: "bili", bvid: item.bvid, page: r.page, name: r.title, author: r.author || item.author || "", pic: r.pic });
      }

      // 使电台状态机 / 看门狗失效，切换为点播音频源
      state.session = (state.session || 0) + 1;
      connectAttempt = 0;
      state.failing = false;
      stopWatchdog();          // 点播自带进度，FM 直播看门狗会把点播开头误判为卡顿并重连（从头重播）
      clearConnectTimer();
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

      // 更新播放器 UI
      els.stationName.textContent = pseudo.name;
      els.stationCountry.textContent = (isPod ? "🎙 播客 · " : "📺 哔哩哔哩 · ") + (r.author || item.author || "");
      els.stationBitrate.textContent = (isPod ? "🎧 播客单集 · " : "🎬 视频转音频 · ") + fmtDur(r.duration);
      els.stationTags.innerHTML =
        `<span class="tag">${isPod ? "播客" : "bilibili"}</span>` +
        (r.author ? `<span class="tag">${escapeHtml(r.author)}</span>` : "");
      updateFSMeta(pseudo);
      els.artImg.style.display = r.pic ? "" : "none";
      els.artImg.src = r.pic || "";
      document.querySelectorAll(".station-item").forEach((el) => el.classList.remove("active"));
      refreshPlayingIndicator();
      updateFavBtn();
      room.join(pseudo.stationuuid);   // 收听同一节目的人共享弹幕房间

      audio.src = r.stream;
      audio.load();
      audio.play().then(() => {
        setStatus(`正在播放${isPod ? "播客" : " B 站音频"}：${pseudo.name}`, "ok");
      }).catch((e2) => {
        setStatus("音频播放失败：" + (e2.message || "未知错误"), "error");
      });

      // 显示点播进度条并复位
      els.progRow.classList.remove("hidden");
      els.progBar.value = 0;
      els.progCur.textContent = "0:00";
      els.progDur.textContent = r.duration ? fmtDur(r.duration) : "--:--";

      // 弹窗底部：当前播放 + 分P选择（播客无分P）
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

  /* ---------- 点播进度条（B站节目等非实时内容可拖动 / 电台直播自动隐藏） ---------- */
  function isBiliAudio() {
    return !!(state.curStation && String(state.curStation.url_resolved || "").startsWith("bilaudio://"));
  }
  function biliDuration() {
    // 优先用播放器元数据；流式 mp4 拿不到时退回解析接口返回的时长（秒）
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

  /* ---------- B站手动上一首 / 下一首（含分P，← → 方向键同样生效） ---------- */
  function biliPrevTarget() {
    if (!bili.current) return null;
    const { item, info } = bili.current;
    // 多P视频：先回上一P
    if (info && info.pages && info.pages.length > 1 && info.page > 1) {
      return { item, page: info.page - 1 };
    }
    const list = biliCurrentList();
    const idx = list.findIndex((x) => vodKey(x) === vodKey(item));
    if (idx > 0) return { item: list[idx - 1], page: 1 };
    return null;
  }
  function biliSkip(dir) {
    // 不在播B站内容时，退化为普通电台切台
    if (!isBiliAudio() || !bili.current) {
      playIndex((state.current ?? -1) + dir);
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

  /* ---------- 播放历史（最近 50 条：电台 + B站点播 + 播客） ---------- */
  function fmtAgo(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + " 秒前";
    if (s < 3600) return Math.floor(s / 60) + " 分钟前";
    if (s < 86400) return Math.floor(s / 3600) + " 小时前";
    return Math.floor(s / 86400) + " 天前";
  }
  function recordHistory(entry) {
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
            <span class="history-time">${fmtAgo(h.ts)}</span>
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
            <span class="history-time">${fmtAgo(h.ts)}</span>
          </div>`;
      }
      return `
        <div class="history-item" data-i="${i}" title="${escapeHtml(h.s.name)}">
          <img class="history-thumb" src="${escapeHtml(h.s.favicon || "")}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">
          <div class="history-info">
            <div class="history-name">${escapeHtml(h.s.name)}</div>
            <div class="history-sub">${flagFull(h.s.countrycode)} ${escapeHtml(h.s.country || "未知地区")}</div>
          </div>
          <span class="history-time">${fmtAgo(h.ts)}</span>
        </div>`;
    }).join("");
  }
  els.historyBtn.addEventListener("click", () => {
    renderHistory();
    els.historyPanel.classList.remove("hidden");
  });
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
      playBili(h.ep, 1);
    } else if (h.type === "bili") {
      playBili({ bvid: h.bvid, author: h.author, title: h.name, pic: h.pic }, h.page || 1);
    } else {
      // 尽量在当前列表中定位高亮；找不到则作为独立电台播放
      const idx = state.stations.findIndex((x) => x.stationuuid === h.s.stationuuid);
      playStation(h.s, idx >= 0 ? idx : null);
    }
  });

  /* ---------- 温度金句栏：积极短句轮播（多种随机动效） ---------- */
  // 本地语料库（150 条）：每天从其中按日期种子抽取 50 条，接入一言 API 混入精选
  const QUOTE_POOL = [
    "把日子过成诗，简单而精致。",
    "慢慢来，比较快。",
    "生活明朗，万物可爱，人间值得，未来可期。",
    "凡是过往，皆为序章；凡是未来，皆有可期。",
    "种一棵树最好的时间是十年前，其次是现在。",
    "心里有光，哪里都是方向。",
    "山不过来，我就过去。",
    "步履不停，终会抵达。",
    "你现在的努力，是未来的你看得见的底气。",
    "清醒时做事，糊涂时读书，独处时思考。",
    "日拱一卒，功不唐捐。",
    "把平凡的日子过出滋味，就是了不起的生活。",
    "允许一切发生，然后接住它。",
    "星光不问赶路人，时光不负有心人。",
    "热爱可抵岁月漫长。",
    "先努力优秀，再大方拥有。",
    "与其临渊羡鱼，不如退而结网。",
    "风会带走一切烦恼，也会带来新的开始。",
    "慢慢理解世界，慢慢更新自己。",
    "低头赶路，敬事如仪；抬头看天，自有山河。",
    "知足且上进，温柔而坚定。",
    "生活的最佳状态，是冷冷清清的风风火火。",
    "保持热爱，奔赴山海。",
    "所谓自由，不是随波逐流，而是有所选择。",
    "今天也要好好吃饭，好好睡觉，好好生活。",
    "一切发生皆有利于我。",
    "路虽远，行则将至；事虽难，做则必成。",
    "爱自己是终身浪漫的开始。",
    "读书、运动、早睡，是性价比最高的自我投资。",
    "花有重开日，人无再少年，此刻即最好。",
    "乐观的人，在每个困难里看到机会。",
    "你的时间花在哪里，你的人生就长成什么样。",
    "静下来，答案会自己浮出水面。",
    "世界很大，值得你慢慢去看。",
    "把今天过好，就是对未来最大的诚意。",
    "与其焦虑明天，不如做好今天。",
    "温和而有力量，谦逊而有锋芒。",
    "愿你眼里有光，心中有海，脚下有路。",
    "认真生活的人，运气不会太差。",
    "勇敢的人，先享受世界。",
    "所有的惊艳，都来自长久的积累。",
    "保持好奇心，永远年轻。",
    "允许自己做自己，允许别人做别人。",
    "别慌，月亮也正在大海某处迷茫。",
    "机会都藏在认真里。",
    "日落归山海，山海藏深意。",
    "小步快走，也是一种浪漫。",
    "每一个不曾起舞的日子，都是对生命的辜负。",
    "心怀感恩，所见皆温柔。",
    "身体和灵魂，总要有一个在路上。",
    "春有百花秋有月，夏有凉风冬有雪。",
    "行到水穷处，坐看云起时。",
    "莫听穿林打叶声，何妨吟啸且徐行。",
    "竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。",
    "回首向来萧瑟处，归去，也无风雨也无晴。",
    "长风破浪会有时，直挂云帆济沧海。",
    "沉舟侧畔千帆过，病树前头万木春。",
    "问渠那得清如许？为有源头活水来。",
    "纸上得来终觉浅，绝知此事要躬行。",
    "不畏浮云遮望眼，自缘身在最高层。",
    "千磨万击还坚劲，任尔东西南北风。",
    "宝剑锋从磨砺出，梅花香自苦寒来。",
    "山重水复疑无路，柳暗花明又一村。",
    "会当凌绝顶，一览众山小。",
    "天生我材必有用，千金散尽还复来。",
    "勿以善小而不为，勿以恶小而为之。",
    "静以修身，俭以养德。",
    "非淡泊无以明志，非宁静无以致远。",
    "博学之，审问之，慎思之，明辨之，笃行之。",
    "天行健，君子以自强不息。",
    "地势坤，君子以厚德载物。",
    "岁寒，然后知松柏之后凋也。",
    "知者不惑，仁者不忧，勇者不惧。",
    "见贤思齐焉，见不贤而内自省也。",
    "三人行，必有我师焉。",
    "逝者如斯夫，不舍昼夜。",
    "吾生也有涯，而知也无涯。",
    "独学而无友，则孤陋而寡闻。",
    "玉不琢，不成器；人不学，不知道。",
    "业精于勤，荒于嬉；行成于思，毁于随。",
    "尺有所短，寸有所长。",
    "临渊羡鱼，不如退而结网。",
    "精诚所至，金石为开。",
    "绳锯木断，水滴石穿。",
    "千里之行，始于足下。",
    "胜人者有力，自胜者强。",
    "知人者智，自知者明。",
    "大直若屈，大巧若拙，大辩若讷。",
    "祸兮福之所倚，福兮祸之所伏。",
    "合抱之木，生于毫末；九层之台，起于累土。",
    "圣人无常心，以百姓心为心。",
    "上善若水，水善利万物而不争。",
    "夫唯不争，故天下莫能与之争。",
    "大道至简，知易行难。",
    "君子藏器于身，待时而动。",
    "穷则变，变则通，通则久。",
    "二人同心，其利断金。",
    "满招损，谦受益。",
    "良药苦口利于病，忠言逆耳利于行。",
    "有志者，事竟成。",
    "老骥伏枥，志在千里；烈士暮年，壮心不已。",
    "非学无以广才，非志无以成学。",
    "静水流深，沧笙踏歌。",
    "心之所向，素履以往。",
    "生如逆旅，一苇以航。",
    "愿历尽千帆，归来仍是少年。",
    "腹有诗书气自华。",
    "人生如逆旅，我亦是行人。",
    "此心安处，便是吾乡。",
    "休对故人思故国，且将新火试新茶。",
    "诗酒趁年华。",
    "一蓑烟雨任平生，也无风雨也无晴。",
    "人生自是有情痴，此恨不关风与月。",
    "最是人间留不住，朱颜辞镜花辞树，所以要珍惜当下。",
    "自是花中第一流。",
    "何须浅碧深红色，自是花中第一流。",
    "点点梅花，皆是傲骨。",
    "夜来风雨声，花落知多少，落花亦是新生。",
    "随风潜入夜，润物细无声。",
    "会当水击三千里，自信人生二百年。",
    "横眉冷对千夫指，俯首甘为孺子牛。",
    "其实地上本没有路，走的人多了，也便成了路。",
    "愿中国青年都摆脱冷气，只是向上走。",
    "有一分热，发一分光。",
    "此后如竟没有炬火，我便是唯一的光。",
    "改造自己，总比禁止别人来得难。",
    "时间就像海绵里的水，只要愿挤，总还是有的。",
  ];
  /* ---- 每日金句：每天 50 条，本机时间 0 点自动刷新，接入一言(Hitokoto) API 混入精选 ---- */
  const QUOTE_DAILY_COUNT = 50;
  const QUOTE_API = "https://v1.hitokoto.cn/?c=d&c=i&c=k&c=e&max_length=30";
  const QUOTE_FX = ["up", "side", "fade", "pixel", "type", "flip"];
  let dailyQuotes = [];        // 当日 50 条清单
  let dailyApiQuotes = [];     // API 拉到的精选（当天内缓存，成功后自动混入）
  let quoteIdx = -1;
  let quoteDayKey = "";
  let quoteTimer = null;
  let quoteRollTimer = null;
  let quoteBusy = false;

  function quoteDayKeyOf(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  // 用日期做随机种子：同一天抽到的组合稳定，跨天必然不同
  function seedFromKey(key) {
    let h = 2166136261;
    for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleWith(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // 一言 API：文学/诗词/哲学/原创 分类，并发拉 15 条，失败静默降级为纯本地语料
  async function fetchQuoteApi() {
    const tasks = Array.from({ length: 15 }, () =>
      fetch(QUOTE_API).then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.hitokoto) ? String(j.hitokoto).trim() : null)
        .catch(() => null)
    );
    const rs = await Promise.allSettled(tasks);
    const out = [];
    for (const r of rs) if (r.status === "fulfilled" && r.value) out.push(r.value);
    return [...new Set(out)];
  }
  function buildDailyQuotes(apiExtra) {
    const rnd = mulberry32(seedFromKey(quoteDayKey));
    const merged = [...(apiExtra || []), ...QUOTE_POOL];
    const seen = new Set(), uniq = [];
    for (const q of merged) { if (q && !seen.has(q)) { seen.add(q); uniq.push(q); } }
    dailyQuotes = shuffleWith(uniq, rnd).slice(0, QUOTE_DAILY_COUNT);
  }
  function startQuoteDay(withApi) {
    quoteDayKey = quoteDayKeyOf();
    buildDailyQuotes(withApi ? dailyApiQuotes : []);
    quoteIdx = -1;
    showQuote();            // 立即展示当日第一句
    restartQuoteTimer();
  }
  // 每 30 秒检查一次本机日期：跨过 0 点 → 重建当日 50 条（API 结果后台补混入）
  function rollQuoteDay() {
    if (quoteDayKeyOf() === quoteDayKey) return;
    startQuoteDay(false);
    fetchQuoteApi().then((api) => {
      if (api.length && quoteDayKeyOf() === quoteDayKey) {
        dailyApiQuotes = api;
        buildDailyQuotes(api);
      }
    });
  }
  quoteRollTimer = setInterval(rollQuoteDay, 30000);

  function clearFx(el) {
    el.classList.remove("fx-up-in", "fx-up-out", "fx-side-in", "fx-side-out",
      "fx-fade-in", "fx-fade-out", "fx-pixel-in", "fx-pixel-out", "fx-flip-in", "fx-flip-out");
  }
  // 把旧句克隆一层负责"出场"动画，新句在原位做"入场"动画
  function spawnOut(text, fx) {
    const stage = els.quoteText.parentElement;
    const out = document.createElement("div");
    out.className = "quote-text fx-" + fx + "-out";
    out.textContent = text;
    stage.appendChild(out);
    setTimeout(() => out.remove(), 700);
  }
  function typewriterIn(text) {
    els.quoteText.textContent = "";
    els.quoteText.classList.add("typing");
    let i = 0;
    const t = setInterval(() => {
      els.quoteText.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(t);
        setTimeout(() => els.quoteText.classList.remove("typing"), 600);
      }
    }, 55);
  }
  function showQuote(manual) {
    if (quoteBusy) return;
    quoteBusy = true;
    const fx = QUOTE_FX[Math.floor(Math.random() * QUOTE_FX.length)];
    const oldText = els.quoteText.textContent;
    // 当日清单内顺序轮播（循环），点"换一句"即顺延下一条
    if (!dailyQuotes.length) dailyQuotes = QUOTE_POOL.slice(0, QUOTE_DAILY_COUNT);
    quoteIdx = (quoteIdx + 1) % dailyQuotes.length;
    const text = dailyQuotes[quoteIdx];
    if (fx === "type") {
      if (oldText) spawnOut(oldText, "fade");
      typewriterIn(text);
    } else {
      if (oldText) spawnOut(oldText, fx);
      clearFx(els.quoteText);
      // 强制 reflow，保证连续同一动效也能重放
      void els.quoteText.offsetWidth;
      els.quoteText.classList.add("fx-" + fx + "-in");
      els.quoteText.textContent = text;
    }
    if (manual) restartQuoteTimer();
    setTimeout(() => { clearFx(els.quoteText); quoteBusy = false; }, 750);
  }
  function restartQuoteTimer() {
    clearInterval(quoteTimer);
    quoteTimer = setInterval(showQuote, 10000);
  }
  els.quoteBar.addEventListener("click", () => showQuote(true));
  els.quoteNext.addEventListener("click", (e) => { e.stopPropagation(); showQuote(true); });
  // 启动：本地当日清单先上屏（无网络也有内容），一言 API 结果到了再静默混入
  startQuoteDay(false);
  fetchQuoteApi().then((api) => {
    dailyApiQuotes = api;
    buildDailyQuotes(api);
  });

  /* ---------- 启动 ---------- */
  refreshHints();
  // 恢复上次的音量 / 静音状态
  const savedVol = +localStorage.getItem("aurora_vol");
  const savedMuted = localStorage.getItem("aurora_muted") === "1";
  if (savedMuted) { state.muted = false; toggleMute(); } // 复用 toggleMute 写入样式
  if (savedVol > 0) setVolume(savedVol); else setVolume(80);

  // 默认加载北京电台
  state.keyword = "北京";
  els.searchInput.value = "北京";
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));

  // 退出清理：停止音频流、清除自动轮播/助眠定时器（同时暴露给主进程调用）
  window.__auroraCleanup = () => {
    stopAuto();
    stopSleep();
    stopWatchdog();
    saveStats();
    clearInterval(quoteTimer);
    clearInterval(quoteRollTimer);
    room.leave();               // 退出弹幕频道并断开本机服务连接
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch (_) { /* ignore */ }
  };
  window.addEventListener("beforeunload", window.__auroraCleanup);

  load().then(() => {
    // 恢复上次播放的电台
    const lastId = localStorage.getItem("aurora_last");
    if (lastId) {
      const idx = state.stations.findIndex((s) => s.stationuuid === lastId);
      if (idx >= 0) playIndex(idx);
    }
  });
})();
