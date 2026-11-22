/* Aurora FM — room.js
 * 同频道弹幕房间（公共云端 MQTT 中继：跨机器 / 跨网络互通；局域网 WS 兜底）。
 */

import { els, escapeHtml, setStatus, registry } from "./core.js";

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

  const PUBLIC_RELAYS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://test.mosquitto.org:8081/mqtt",
  ];
  const NS = "aurora-fm/v1";
  const PRESENCE_MS = 5000;
  const PEER_TTL = 16000;

  let cfg = loadCfg();
  let wantedRoom = null;
  let retryTimer = null;
  let dead = false;

  let mqtt = null;
  let ws = null;
  let mode = "offline";
  let subRoom = null;
  let connTimer = null;

  const peers = new Map();

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

  let gen = 0;
  let presenceTimer = null;
  let sweepTimer = null;

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
      if (m.id === myId) return;
      handleMessage({ type: "chat", id: m.id, name: m.name, text: m.text });
    } else if (kind === "presence") {
      if (!m.id || m.id === myId) return;
      const isNew = !peers.has(m.id);
      peers.set(m.id, { name: m.name || "侠客", ts: Date.now() });
      if (isNew) {
        spawnSys(`${m.name || "侠客"} 进入了电台`);
        sendPresence();
      }
      updateCount(peers.size + 1);
    } else if (kind === "sys") {
      handleMessage({ type: "sys", text: m.text });
    }
  }

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
      connectCloud(urls, attempt + 1, myGen);
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
    if (!changed && mode !== "offline") return;

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
      spawnDanmaku(myName, text, true);
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
  window.__auroraRoom = api;
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

registry.room = room;

export default room;
