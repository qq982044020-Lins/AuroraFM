/* Aurora FM — viz.js
 * 炫酷频谱可视化：12 种形态（条形/气泡/星环/涟漪/火苗/星云/螺旋/山脉/极光/烟花/雷达/波形）。
 * 主画布与全屏画布共用同一渲染引擎；能量由主画布的动画循环驱动，全屏画布通过 energies() 读取。
 */

import { els, audio, state, registry } from "./core.js";

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

const api = {
  stop: () => cancelAnimationFrame(raf),
  energies: () => bars.map((b) => b.v),
  render,
};
registry.viz = api;

export default api;
