/* Aurora FM — core.js
 * 共享状态、DOM 引用、纯工具函数，以及跨模块调用注册表（registry）。
 * 本模块零业务依赖，是所有模块的公共底座，避免循环 import。
 */

export const $ = (id) => document.getElementById(id);
export const audio = $("audio");

/* ---------- DOM 元素引用 ---------- */
export const els = {
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

/* ---------- 全局状态 ---------- */
export const state = {
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
  // 运行期字段（原闭包里动态挂载，这里集中声明便于阅读）
  curStation: null,
  curIdx: null,
  session: 0,
  failing: false,
};

export const PAGE_SIZE = 40;

/* ---------- 纯工具函数 ---------- */
export function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function flagFull(cc) {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分 ${sec % 60} 秒`;
}

export function fmtDur(sec) {
  sec = Math.max(0, +sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtPlay(n) {
  n = +n || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "亿";
  if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
  return String(n);
}

export function fmtDate(sec) {
  const d = new Date((+sec || 0) * 1000);
  if (isNaN(d.getTime()) || !+sec) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + " 秒前";
  if (s < 3600) return Math.floor(s / 60) + " 分钟前";
  if (s < 86400) return Math.floor(s / 3600) + " 小时前";
  return Math.floor(s / 86400) + " 天前";
}

export function setStatus(msg, type = "") {
  els.statusBar.textContent = msg;
  els.statusBar.className = "status-bar " + type;
}

/* ---------- 跨模块调用注册表（避免 radio ↔ room / bili ↔ radio 循环 import） ----------
 * 各模块在初始化时把自己对外暴露的方法注册进来，其他模块运行时按需调用。
 * 例如 radio.js 播放电台时调用 registry.room.join(uuid)；
 *      bili.js 播放点播时调用 registry.radio.refreshPlayState()。
 */
export const registry = {
  radio: null,   // { playIndex, playStation, playBlind, ... }
  room: null,    // { join, send, leave, ... }
  bili: null,    // { playBili, biliSkip, isBiliAudio, ... }
  viz: null,     // { render, energies }
  fs: null,      // { enterFS, exitFS, updateFSMeta, pushMiniInfo }
};
