/* Aurora FM — app.js（入口）
 * 按依赖顺序加载各模块：core → viz/radio/room/bili/quote/fs，
 * 然后执行启动装配与退出清理。
 */

import { els, state, audio, registry } from "./core.js";
import "./viz.js";       // 内部注册 registry.viz 并启动主画布动画循环
import radio from "./radio.js";   // 内部注册 registry.radio，绑定电台相关事件
import "./room.js";      // 内部注册 registry.room，绑定弹幕相关事件
import "./bili.js";      // 内部注册 registry.bili，绑定 B站/播客相关事件
import quote from "./quote.js";   // 温度金句栏
import "./fs.js";        // 内部注册 registry.fs，绑定标题栏/全屏/悬浮球

/* ---------- 启动 ---------- */
radio.refreshHints();

// 恢复上次的音量 / 静音状态
const savedVol = +localStorage.getItem("aurora_vol");
const savedMuted = localStorage.getItem("aurora_muted") === "1";
if (savedMuted) { state.muted = false; radio.toggleMute(); }
if (savedVol > 0) radio.setVolume(savedVol); else radio.setVolume(80);

// 默认加载北京电台
state.keyword = "北京";
els.searchInput.value = "北京";
document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));

// 退出清理：停止音频流、清除定时器
window.__auroraCleanup = () => {
  radio.stopAuto();
  radio.stopSleep();
  radio.stopWatchdog();
  radio.saveStats();
  quote.cleanup();
  if (registry.room) registry.room.leave();
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch (_) { /* ignore */ }
};
window.addEventListener("beforeunload", window.__auroraCleanup);

radio.load().then(() => {
  // 恢复上次播放的电台
  const lastId = localStorage.getItem("aurora_last");
  if (lastId) {
    const idx = state.stations.findIndex((s) => s.stationuuid === lastId);
    if (idx >= 0) radio.playIndex(idx);
  }
});
