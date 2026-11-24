/* Aurora FM — fs.js
 * 自定义标题栏窗口控制、迷你悬浮球、全屏屏保模式、键盘快捷键。
 */

import { $, els, audio, state, escapeHtml, flagFull, registry } from "./core.js";

let fsActive = false;

function updateFSMeta(s) {
  if (!s || !s.name) return;
  els.fsName.textContent = s.name;
  els.fsInfo.textContent = `${flagFull(s.countrycode)} ${s.country || "未知地区"} · ${s.bitrate || "?"} kbps`;
  els.fsTags.innerHTML = (s.tags || "")
    .split(",").filter(Boolean).slice(0, 5)
    .map((t) => `<span class="tag">${escapeHtml(t.trim())}</span>`).join("");
}

const isNativeCapacitor = () =>
  !!(window.Capacitor &&
    (typeof window.Capacitor.isNativePlatform === "function"
      ? window.Capacitor.isNativePlatform()
      : window.Capacitor.isNative));

const isTouchDevice =
  (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
  navigator.maxTouchPoints > 0;

// 触屏设备不显示键盘快捷键提示；桌面端保留 Esc 说明
els.fsExit.textContent = isTouchDevice ? "✕ 退出全屏" : "✕ 退出全屏（Esc）";

function enterFS() {
  fsActive = true;
  els.fsOverlay.classList.remove("hidden");
  updateFSMeta(state.curStation);
  if (window.aurora) {
    window.aurora.setFullscreen(true);
  } else if (!isNativeCapacitor()) {
    // Capacitor 内只用 CSS 覆盖层，避免触发 iOS 原生全屏横幅与退出白边
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

function exitFS() {
  fsActive = false;
  els.fsOverlay.classList.add("hidden");
  if (window.aurora) {
    window.aurora.setFullscreen(false);
  } else if (!isNativeCapacitor() && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener("fullscreenchange", () => {
  if (fsActive && !document.fullscreenElement && !window.aurora && !isNativeCapacitor()) exitFS();
});

// 触屏下滑退出：与 iOS 全屏手势一致，桌面仍可用右上角按钮或 Esc
let fsTouchStartY = null;
let fsTouchStartX = null;
els.fsOverlay.addEventListener("touchstart", (e) => {
  if (!fsActive || e.target.closest("button, input, select, a")) return;
  const t = e.changedTouches[0];
  fsTouchStartY = t.clientY;
  fsTouchStartX = t.clientX;
}, { passive: true });
els.fsOverlay.addEventListener("touchend", (e) => {
  if (fsTouchStartY === null || !fsActive) return;
  const t = e.changedTouches[0];
  const dy = t.clientY - fsTouchStartY;
  const dx = Math.abs(t.clientX - fsTouchStartX);
  fsTouchStartY = null;
  fsTouchStartX = null;
  if (dy > 80 && dx < 60) exitFS();
}, { passive: true });

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
      if (cmd === "togglePlay") registry.radio.togglePlay();
      else if (cmd === "prev") registry.bili.biliSkip(-1);
      else if (cmd === "next") registry.bili.biliSkip(1);
      else if (cmd === "info") pushMiniInfo();
    });
  }
} else {
  document.querySelector(".tb-controls").classList.add("hidden");
  document.body.classList.add("no-room");
}

function pushMiniInfo() {
  if (!window.aurora || !window.aurora.sendMiniInfo) return;
  window.aurora.sendMiniInfo({
    title: (state.curStation && state.curStation.name) || "Aurora FM",
    playing: !audio.paused && !!audio.src,
  });
}

/* ---------- 全屏屏保 ---------- */
els.fsBtn.addEventListener("click", enterFS);
els.fsExit.addEventListener("click", exitFS);
els.fsPrev.addEventListener("click", () => registry.radio.playIndex(state.curIdx - 1));
els.fsNext.addEventListener("click", () => registry.radio.playIndex(state.curIdx + 1));
els.fsPlay.addEventListener("click", () => registry.radio.togglePlay());

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

// 屏保频谱：复用主频谱能量与 12 种形态渲染
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

    const es = registry.viz.energies();
    const avg = es.reduce((a, x) => a + x, 0) / es.length;
    const playing = !audio.paused && state.current >= 0;
    registry.viz.render(ctx, w, h, es, performance.now() / 1000, playing, avg);
  }
  draw();
})();

/* ---------- 键盘快捷键 ---------- */
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.code === "Space") { e.preventDefault(); registry.radio.togglePlay(); }
  if (e.code === "KeyF") { fsActive ? exitFS() : enterFS(); }
  if (e.code === "Escape" && fsActive) exitFS();
  if (e.code === "ArrowLeft") registry.bili.biliSkip(-1);
  if (e.code === "ArrowRight") registry.bili.biliSkip(1);
  if (e.code === "ArrowUp") { e.preventDefault(); const v = Math.min(100, +els.volumeSlider.value + 5); els.volumeSlider.value = v; registry.radio.setVolume(v); }
  if (e.code === "ArrowDown") { e.preventDefault(); const v = Math.max(0, +els.volumeSlider.value - 5); els.volumeSlider.value = v; registry.radio.setVolume(v); }
});

/* ---------- 对外暴露 ---------- */
const api = {
  enterFS,
  exitFS,
  updateFSMeta,
  pushMiniInfo,
};
registry.fs = api;

export default api;
