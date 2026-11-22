const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aurora", {
  minimize: () => ipcRenderer.send("win:minimize"),
  toggleMaximize: () => ipcRenderer.send("win:toggleMaximize"),
  close: () => ipcRenderer.send("win:close"),
  setFullscreen: (on) => ipcRenderer.send("win:fullscreen", on),
  onMaximizeChange: (cb) => ipcRenderer.on("win:maximizeChanged", (_e, v) => cb(v)),
  // 悬浮球迷你模式：主窗口与迷你窗口共用同一份 preload
  miniMode: () => ipcRenderer.send("mini:enter"),
  miniRestore: () => ipcRenderer.send("mini:restore"),
  miniCmd: (cmd) => ipcRenderer.send("mini:cmd", cmd),
  miniDrag: (dx, dy) => ipcRenderer.send("mini:drag", dx, dy),
  miniMenu: () => ipcRenderer.send("mini:menu"),
  miniQuit: () => ipcRenderer.send("mini:quit"),
  sendMiniInfo: (info) => ipcRenderer.send("mini:info", info),
  miniGetInfo: () => ipcRenderer.invoke("mini:getInfo"),
  onMiniInfo: (cb) => ipcRenderer.on("mini:info", (_e, v) => cb(v)),
  onMiniCmd: (cb) => ipcRenderer.on("mini:cmd", (_e, v) => cb(v)),
  roomPort: () => ipcRenderer.invoke("room:port"),
  roomLanIps: () => ipcRenderer.invoke("room:lanIps"),
  // 哔哩哔哩：搜索视频 / 解析音频流（主进程代理，绕过跨域与 CDN 校验）
  biliSearch: (keyword, page, mode, order) => ipcRenderer.invoke("bili:search", keyword, page, mode, order),
  biliResolve: (bvid, page) => ipcRenderer.invoke("bili:resolve", bvid, page),
  // Apple 播客：搜索节目 / 拉取 RSS 单集列表
  podcastSearch: (keyword) => ipcRenderer.invoke("podcast:search", keyword),
  podcastEpisodes: (feedUrl, podcastInfo) => ipcRenderer.invoke("podcast:episodes", feedUrl, podcastInfo),
});
