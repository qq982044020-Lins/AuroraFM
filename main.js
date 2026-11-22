const { app, BrowserWindow, globalShortcut, ipcMain, protocol, net, screen, Menu } = require("electron");
const path = require("path");
const crypto = require("crypto");

// 哔哩哔哩音频流代理协议：必须在 app ready 前注册为特权协议才能用于媒体播放
protocol.registerSchemesAsPrivileged([
  { scheme: "bilaudio", privileges: { stream: true, supportFetchAPI: true } },
]);

// 允许多实例运行：同一台机器可开多个窗口验证「同频道多人在线」。
// 本机服务端口会自动向后扫描，互不冲突；全局快捷键仅首个实例注册成功。
let mainWindow = null;
let miniWindow = null;   // 悬浮球迷你窗口

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    title: "Aurora FM",
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: "#0b0e17",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // 主窗口隐藏进入悬浮球模式后，音频不能被 Chromium 后台节流
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;
  win.loadFile(path.join(__dirname, "index.html"));

  // 阻止页面标题覆盖窗口标题
  win.on("page-title-updated", (e) => e.preventDefault());
  win.on("closed", () => { mainWindow = null; });

  // 最大化状态变化时通知渲染层（用于切换布局样式）
  const sendMaxState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("win:maximizeChanged", mainWindow.isMaximized());
    }
  };
  win.on("maximize", sendMaxState);
  win.on("unmaximize", sendMaxState);
}

// 自定义标题栏的窗口控制
ipcMain.on("win:minimize", () => mainWindow && mainWindow.minimize());
ipcMain.on("win:toggleMaximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
let appQuitting = false;
ipcMain.on("win:close", () => {
  appQuitting = true;
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
  mainWindow && mainWindow.close();
});
ipcMain.on("win:fullscreen", (_e, on) => mainWindow && mainWindow.setFullScreen(!!on));
app.on("before-quit", () => { appQuitting = true; });

/* ---------- 悬浮球迷你模式：右上角半透明小窗 ---------- */
const MINI_SIZE = 108;
// 缓存最近一次播放信息：悬浮球页面加载慢于主窗口推送时，加载完成后主动补发，避免丢失
let lastMiniInfo = { title: "Aurora FM", playing: false };

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.showInactive();
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  miniWindow = new BrowserWindow({
    width: MINI_SIZE,
    height: MINI_SIZE,
    x: wa.x + wa.width - MINI_SIZE - 24,
    y: wa.y + 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: "Aurora FM 悬浮球",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  miniWindow.setAlwaysOnTop(true, "screen-saver");
  miniWindow.loadFile(path.join(__dirname, "mini.html"));
  // 悬浮球被意外关闭（如 Alt+F4）时，不销毁而是还原主窗口，避免应用"消失"
  miniWindow.on("close", (e) => {
    if (appQuitting) return;
    e.preventDefault();
    restoreFromMini();
  });
  miniWindow.on("closed", () => { miniWindow = null; });
}

// 还原主窗口（悬浮球模式下调用）
function restoreFromMini() {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.hide();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

// 悬浮球控制指令下发给主窗口渲染层
function sendMiniCmd(cmd) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("mini:cmd", cmd);
  }
}

ipcMain.on("mini:enter", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  mainWindow.hide();
  createMiniWindow();
  sendMiniCmd("info");   // 让主窗口立刻推送一次当前播放信息
});
ipcMain.on("mini:restore", restoreFromMini);
ipcMain.on("mini:quit", () => {
  appQuitting = true;   // 放行所有窗口的 close，交由 app.quit 统一收尾
  app.quit();
});
ipcMain.on("mini:cmd", (_e, cmd) => sendMiniCmd(cmd));
// 主窗口上报播放状态 → 只更新缓存；悬浮球用 invoke 主动拉取（请求-响应，无时序问题）
ipcMain.on("mini:info", (_e, info) => {
  if (info && typeof info === "object") lastMiniInfo = info;
});
ipcMain.handle("mini:getInfo", () => lastMiniInfo);
ipcMain.on("mini:drag", (_e, dx, dy) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    const [x, y] = miniWindow.getPosition();
    miniWindow.setPosition(x + Math.round(dx), y + Math.round(dy));
  }
});
ipcMain.on("mini:menu", () => {
  const tpl = [
    { label: "⏮  上一台", click: () => sendMiniCmd("prev") },
    { label: "⏯  播放 / 暂停", click: () => sendMiniCmd("togglePlay") },
    { label: "⏭  下一台", click: () => sendMiniCmd("next") },
    { type: "separator" },
    { label: "🗖  还原主窗口", click: restoreFromMini },
    { label: "✕  退出 Aurora FM", click: () => app.quit() },
  ];
  Menu.buildFromTemplate(tpl).popup();
});

/* ---------- 本机/局域网弹幕共享服务（WebSocket，按电台频道分组） ---------- */
let roomPort = 0;
let roomHttp = null;
let roomWss = null;
let roomHeartbeat = null;
let roomBcaster = null;

function startRoomServer() {
  if (roomWss) return;
  let WSS;
  try {
    WSS = require("ws").WebSocketServer;
  } catch (_) {
    return; // ws 未安装则静默跳过
  }

  const rooms = new Map(); // room -> Set<conn>
  roomHttp = require("http").createServer();
  roomWss = new WSS({ server: roomHttp });
  // ws 会把 httpServer 的 'error' 转发成 wss.emit('error')；若不监听，
  // 端口被占用（多开 / 上次进程残留）时该错误会变成未捕获异常，弹出
  // 「A JavaScript error occurred in the main process」并直接终止主进程。
  roomWss.on("error", () => {});
  roomHttp.on("error", () => {});

  const PORTS = [37990, 37991, 37992, 37993, 37994, 37995, 37996, 37997, 37998, 37999];

  const roomConns = (room) => {
    if (!rooms.has(room)) rooms.set(room, new Set());
    return rooms.get(room);
  };

  const broadcast = (room, data, except) => {
    const set = rooms.get(room);
    if (!set) return;
    const msg = JSON.stringify(data);
    for (const conn of set) {
      if (conn !== except && conn.ws.readyState === 1) conn.ws.send(msg);
    }
  };

  const sendCount = (room) => {
    broadcast(room, { type: "count", n: roomConns(room).size });
  };

  roomWss.on("connection", (ws) => {
    ws.isAlive = true;
    const conn = { ws, room: null, name: "", id: "", alive: true };
    ws.on("pong", () => { conn.alive = true; });

    let joined = false;
    const joinTimer = setTimeout(() => {
      if (!joined) ws.terminate(); // 10 秒内没进频道则断开，防止野连接
    }, 10000);

    ws.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch (_) { return; }
      if (m.type === "join") {
        const room = String(m.room || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
        const name = String(m.name || "").slice(0, 16);
        conn.id = String(m.id || "").slice(0, 40);
        if (!room || !name) return;
        joined = true;
        clearTimeout(joinTimer);
        // 换频道：先退出旧房间
        if (conn.room) {
          const old = conn.room;
          roomConns(old).delete(conn);
          broadcast(old, { type: "sys", text: `${conn.name} 去了别的电台` });
          sendCount(old);
        }
        conn.room = room;
        conn.name = name;
        roomConns(room).add(conn);
        broadcast(room, { type: "sys", text: `${name} 进入了电台` }, conn);
        sendCount(room);
      } else if (m.type === "chat" && conn.room) {
        const text = String(m.text || "").trim().slice(0, 60);
        if (!text) return;
        broadcast(conn.room, { type: "chat", id: conn.id, name: conn.name, text });
      } else if (m.type === "ping") {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", () => {
      clearTimeout(joinTimer);
      if (conn.room) {
        const old = conn.room;
        roomConns(old).delete(conn);
        broadcast(old, { type: "sys", text: `${conn.name} 离开了` });
        sendCount(old);
        if (!roomConns(old).size) rooms.delete(old);
      }
    });
    ws.on("error", () => ws.terminate());
  });

  // 心跳：30 秒无响应的连接判定掉线
  roomHeartbeat = setInterval(() => {
    if (!roomWss) return;
    for (const ws of roomWss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  // 每 15 秒向各频道广播一次在线人数兜底刷新
  roomBcaster = setInterval(() => {
    for (const room of rooms.keys()) sendCount(room);
  }, 15000);

  // 端口占用时自动向后扫描：改用常驻 error 监听驱动，避免 once 反复注册/移除
  // 的竞态；EADDRINUSE 不再冒泡成未捕获异常，最多尝试完所有端口后静默放弃本机服务。
  let portIdx = 0;
  const tryNextPort = () => {
    if (!roomHttp || portIdx >= PORTS.length) return; // 全被占用 → 仅靠云端中继
    const port = PORTS[portIdx++];
    roomHttp.listen(port, "0.0.0.0", () => { roomPort = port; });
  };
  roomHttp.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") tryNextPort();
    // 其它 error 一律吞掉，绝不让主进程因端口问题崩溃
  });
  tryNextPort();
}

function stopRoomServer() {
  try {
    if (roomHeartbeat) clearInterval(roomHeartbeat);
    if (roomBcaster) clearInterval(roomBcaster);
    roomHeartbeat = roomBcaster = null;
    if (roomWss) {
      for (const ws of roomWss.clients) ws.terminate();
      roomWss.close();
    }
    if (roomHttp) roomHttp.close();
  } catch (_) { /* ignore */ }
  roomWss = roomHttp = null;
  roomPort = 0;
}

ipcMain.handle("room:port", () => roomPort);

// 本机在局域网中的地址（供同网段其他设备直连本机服务）
ipcMain.handle("room:lanIps", () => {
  const os = require("os");
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if ((n.family === "IPv4" || n.family === 4) && !n.internal) ips.push(n.address);
    }
  }
  return ips;
});

/* ---------- 哔哩哔哩：搜索视频并解析音频流（仅取音频播放） ---------- */
const BILI_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const BILI_HEADERS = { "User-Agent": BILI_UA, Referer: "https://www.bilibili.com/", Cookie: "buvid3=infoc" };

// wbi 签名（B 站 web 接口反爬）
const WBI_MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];
function biliGet(url) {
  // 用 Node 原生 https：Electron 主进程的 global fetch 走 Chromium 网络栈，
  // 实测会被 B 站风控拦截返回空结果；原生模块与普通 Node 行为一致。
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, BILI_HEADERS, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return biliGet(new URL(res.headers.location, url).toString()).then(resolve, reject);
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (_) { reject(new Error("B 站接口返回异常 (" + res.statusCode + ")")); }
      });
    });
    req.on("error", (e) => reject(new Error("网络请求失败：" + e.message)));
    req.setTimeout(10000, () => { req.destroy(new Error("请求超时")); });
  });
}
function httpsGet(url, headers, cb) {
  const mod = new URL(url).protocol === "http:" ? require("http") : require("https");
  return mod.get(url, { headers }, cb);
}
function wbiSign(params, imgKey, subKey) {
  const mixin = imgKey + subKey;
  const key = WBI_MIXIN_TAB.map((i) => mixin[i]).join("").slice(0, 32);
  const p = Object.assign({}, params, { wts: Math.floor(Date.now() / 1000) });
  const qs = Object.keys(p).sort()
    .map((k) => `${k}=${encodeURIComponent(String(p[k])).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())}`)
    .join("&");
  p.w_rid = crypto.createHash("md5").update(qs + key).digest("hex");
  return new URLSearchParams(p).toString();
}
async function getWbiKeys() {
  const nav = await biliGet("https://api.bilibili.com/x/web-interface/nav");
  const w = nav && nav.data && nav.data.wbi_img;
  if (!w) throw new Error("获取 B 站签名密钥失败");
  return {
    img: (w.img_url.split("/").pop() || "").split(".")[0],
    sub: (w.sub_url.split("/").pop() || "").split(".")[0],
  };
}
const stripTags = (s) => String(s || "").replace(/<[^>]+>/g, "");
// B 站封面可能是 "http://" 或协议相对 "//"，统一成绝对 https 地址（file:// 页面下才可加载）
const normalizePic = (p) => {
  const s = String(p || "");
  if (s.startsWith("//")) return "https:" + s;
  return s.replace(/^http:/, "https:");
};

// 搜索：mode="video" 直接搜视频；mode="author" 搜博主名字（视频搜索结果按 UP 主聚合）
ipcMain.handle("bili:search", async (_e, keyword, page = 1, mode = "video", order = "totalrank") => {
  const kw = String(keyword || "").trim();
  if (!kw) return { items: [], total: 0 };
  // order: totalrank=综合排序（默认），pubdate=按发布时间从新到旧
  const ord = order === "pubdate" ? "pubdate" : "totalrank";
  const { img, sub } = await getWbiKeys();
  const mapVideo = (v) => ({
    bvid: v.bvid,
    title: stripTags(v.title),
    author: v.author || "",
    duration: v.duration || "",
    pic: normalizePic(v.pic),
    play: v.play || 0,
    pages: v.pages || 1,
    pubdate: v.pubdate || 0,
  });

  if (mode === "author") {
    // 拉取前两页视频搜索结果（共 100 条），按 UP 主聚合；名字命中关键词的博主置顶
    const groups = new Map();
    for (const p of [1, 2]) {
      const qs = wbiSign({ search_type: "video", keyword: kw, page: p, page_size: 50, order: ord }, img, sub);
      const res = await biliGet("https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs);
      if (res.code !== 0) {
        if (p === 1) throw new Error(res.message || ("B 站搜索失败 code=" + res.code));
        break;
      }
      for (const v of (res.data && res.data.result) || []) {
        const name = v.author || "";
        if (!groups.has(name)) groups.set(name, { author: name, count: 0, items: [] });
        const g = groups.get(name);
        g.count++;
        if (g.items.length < 30) g.items.push(mapVideo(v));
      }
    }
    const list = [...groups.values()].sort((a, b) => {
      const ba = (a.author.includes(kw) ? 100000 : 0) + a.count;
      const bb = (b.author.includes(kw) ? 100000 : 0) + b.count;
      return bb - ba;
    }).slice(0, 12);
    return { mode: "author", authors: list };
  }

  const qs = wbiSign(
    { search_type: "video", keyword: kw, page, page_size: 20, order: ord },
    img, sub
  );
  const res = await biliGet("https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs);
  if (res.code !== 0) throw new Error(res.message || ("B 站搜索失败 code=" + res.code));
  const list = (res.data && res.data.result) || [];
  return {
    mode: "video",
    items: list.map(mapVideo),
    total: (res.data && res.data.numResults) || 0,
  };
});

// 解析视频音频流：返回 { title, author, pages:[{page,part,cid}], stream }
ipcMain.handle("bili:resolve", async (_e, bvid, page = 1) => {
  const view = await biliGet(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
  if (view.code !== 0) throw new Error(view.message || "获取视频信息失败");
  const d = view.data;
  const pages = (d.pages || []).map((p) => ({ page: p.page, part: p.part, cid: p.cid }));
  const cur = pages.find((p) => p.page === page) || pages[0];
  const play = await biliGet(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cur.cid}&qn=16&platform=html5&high_quality=0`
  );
  if (play.code !== 0 || !play.data || !(play.data.durl || []).length) {
    throw new Error("获取音频流地址失败");
  }
  const durl = play.data.durl[0];
  // 通过本地 bilaudio:// 协议代理，绕过 CDN 的 Referer 校验并支持 Range 流式播放
  const stream = "bilaudio://play/?u=" + encodeURIComponent(durl.url);
  return {
    title: d.title,
    author: d.owner ? d.owner.name : "",
    pic: normalizePic(d.pic),
    duration: d.duration,
    pages,
    page: cur.page,
    stream,
  };
});

/* ---------- Apple 播客：iTunes 公开搜索 API + 标准 RSS 解析（无需 Key，无风控） ---------- */
// 通用文本抓取（跟随重定向），供 RSS / iTunes JSON 使用
function getText(url, headers) {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, headers || BILI_HEADERS, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getText(new URL(res.headers.location, url).toString(), headers).then(resolve, reject);
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", (e) => reject(new Error("网络请求失败：" + e.message)));
    req.setTimeout(15000, () => { req.destroy(new Error("请求超时")); });
  });
}
const xmlUnescape = (s) => String(s || "")
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'");
// itunes:duration 可能是秒数或 "HH:MM:SS" / "MM:SS"
function parsePodcastDur(s) {
  s = String(s || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return +s;
  const p = s.split(":").map(Number).reverse();
  return (p[0] || 0) + (p[1] || 0) * 60 + (p[2] || 0) * 3600;
}
// 在 XML 块里取指定标签文本
const xmlTag = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? xmlUnescape(m[1]) : "";
};

// 搜索播客节目（iTunes Search API，公开接口）
ipcMain.handle("podcast:search", async (_e, keyword) => {
  const kw = String(keyword || "").trim();
  if (!kw) return { mode: "podcast", items: [] };
  const body = await getText(
    `https://itunes.apple.com/search?term=${encodeURIComponent(kw)}&country=CN&media=podcast&limit=20`,
    { "User-Agent": BILI_UA, "Accept-Language": "zh-CN,zh;q=0.9" }
  );
  let d;
  try { d = JSON.parse(body); } catch (_) { throw new Error("播客搜索返回异常"); }
  const items = (d.results || [])
    .filter((r) => r.feedUrl)
    .map((r) => ({
      kind: "podcast",
      podcastId: r.collectionId,
      title: xmlUnescape(r.collectionName),
      artist: xmlUnescape(r.artistName),
      genre: r.primaryGenreName || "",
      count: r.trackCount || 0,
      pic: (r.artworkUrl160 || r.artworkUrl100 || "").replace(/\/\d+x\d+(bb)?\./, "/600x600"),
      feedUrl: r.feedUrl,
    }));
  return { mode: "podcast", items };
});

// 拉取播客 RSS 并解析全部单集
ipcMain.handle("podcast:episodes", async (_e, feedUrl, podcastInfo) => {
  const u = String(feedUrl || "");
  if (!/^https?:\/\//i.test(u)) throw new Error("无效的播客地址");
  const info = podcastInfo || {};
  const xml = await getText(u, { "User-Agent": BILI_UA });
  // 频道头信息（首个 <item> 之前的部分）
  const head = xml.split(/<item[\s>]/i)[0] || "";
  const podTitle = xmlTag(head, "title") || info.title || "";
  const podArtist = xmlTag(head, "itunes:author") || xmlTag(head, "author") || info.artist || "";
  let podArt = info.pic || "";
  const imgM = head.match(/<itunes:image[^>]*href="([^"]+)"/i) || head.match(/<image[\s\S]*?<url>([\s\S]*?)<\/url>/i);
  if (imgM) podArt = xmlUnescape(imgM[1]);
  // 解析单集
  const episodes = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && episodes.length < 200) {
    const block = m[1];
    let enc = "";
    const em = block.match(/<enclosure[^>]*>/i);
    if (em) {
      const um = em[0].match(/url="([^"]+)"/i);
      if (um) enc = xmlUnescape(um[1]);
    }
    if (!enc) continue;   // 没有音频附件的单集跳过
    const title = xmlTag(block, "title");
    const pubRaw = xmlTag(block, "pubDate");
    const ts = Math.floor((Date.parse(pubRaw) || 0) / 1000);
    const durRaw = xmlTag(block, "itunes:duration") || xmlTag(block, "duration");
    episodes.push({
      kind: "podcast",
      title,
      enclosure: enc,
      pubdate: ts,
      duration: parsePodcastDur(durRaw),
      podTitle,
      artist: podArtist,
      pic: podArt,
    });
  }
  if (!episodes.length) throw new Error("未能解析出可播放的单集（可能全是付费内容）");
  return { podTitle, artist: podArtist, pic: podArt, episodes };
});

// 音频流代理：转发 Range 请求到 B 站 CDN（带 Referer），流式回传给播放器
function registerBilaudioProtocol() {
  protocol.handle("bilaudio", (request) => {
    const u = new URL(request.url);
    const target = u.searchParams.get("u");
    if (!target) return new Response("missing url", { status: 400 });
    return net.fetch(target, {
      headers: Object.assign({}, BILI_HEADERS, {
        Range: request.headers.get("range") || "bytes=0-",
      }),
    }).then((up) => {
      const headers = new Headers();
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const v = up.headers.get(h);
        if (v) headers.set(h, v);
      }
      if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
      return new Response(up.body, { status: up.status, headers });
    }).catch((err) => new Response("proxy error: " + err.message, { status: 502 }));
  });
}

app.whenReady().then(() => {
  registerBilaudioProtocol();
  createWindow();
  startRoomServer();

  // 全局快捷键：任意界面下 Alt+F 换台到下一台
  globalShortcut.register("Alt+F", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.executeJavaScript(
      "document.getElementById('nextBtn').click()"
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());

// 退出前统一清理：注销全局快捷键，关停本机弹幕服务，并让渲染层停止音频流
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopRoomServer();
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.executeJavaScript(
        "window.__auroraCleanup && window.__auroraCleanup()"
      );
    }
  } catch (_) { /* ignore */ }
});
