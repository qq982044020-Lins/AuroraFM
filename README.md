# 📻 Aurora FM

> 靠声音分享与治愈 —— 一个不打扰你、却一直陪着你的「声音角落」。

一个界面美观、完全免费的电台客户端，数据来自开源电台目录 [Radio Browser](https://www.radio-browser.info/)（全球 5 万+ 免费电台，无需任何 API Key）。免费、无广告、无需注册，打开即用。

## 功能

### 📻 电台
- 🔍 搜索全球 5 万+ 电台：按名称 / 国家 / 省州 / 语言 / 标签，支持热门 / 华语 / 音乐 / 新闻分类
- ⏮️ 上一台 / 下一台（键盘 ← → 方向键）
- 🔁 自动轮播（2 / 5 / 10 分钟换台）
- 🎲 电台盲盒：随机飞往全球任意电台
- ⭐ 收藏电台，本地持久化

### 📺 点播
- B站电台：搜视频 / 搜博主 / 分类推荐，只播音频，支持分P、进度条、倍速、自动连播
- 🎙 Apple 播客：iTunes 公开搜索 + RSS 单集解析，收听体验与 B站一致
- 📌 点播收藏夹 + 顶部置顶栏（最多 5 个常听节目）

### ❤️ 温度与陪伴
- ✨ 温度金句栏：本地 150 条语料 + 一言 API，按日期稳定排序，0 点刷新，6 种动效
- 😴 助眠定时：15 / 30 / 60 分钟，最后 1 分钟音量渐弱
- 📖 收听护照：统计收听时长 / 电台数 / 国家数 + 成就徽章
- 💬 同频道弹幕房间：收听同一电台的人可以跨网络互聊
- 🎨 频谱可视化：12 种形态，右键切换样式
- 🪟 迷你悬浮球 + 全屏屏保模式

## 目录结构

```
├── src/               # ES Module 源码（按功能拆分，可阅读维护）
│   ├── core.js        #   共享状态 / DOM 引用 / 工具函数 / 跨模块注册表
│   ├── radio.js       #   电台搜索·列表·播放状态机·护照·盲盒·助眠·收藏
│   ├── viz.js         #   频谱可视化（12 种形态）
│   ├── room.js        #   同频道弹幕房间（云端 MQTT + 局域网兜底）
│   ├── bili.js        #   B站 / 播客 / 点播收藏 / 进度条 / 连播
│   ├── quote.js       #   温度金句栏（本地语料 + 一言 API）
│   ├── fs.js          #   标题栏 / 全屏屏保 / 悬浮球 / 键盘快捷键
│   └── app.js         #   入口：装配各模块 + 启动 + 退出清理
├── build.mjs          # 零配置打包脚本（esbuild，src/ → dist/app.js）
├── main.js            # Electron 主进程
├── preload.js         # 主进程 ↔ 渲染层桥接
└── dist/              # 打包产物（git 忽略，`npm run build` 生成）
```

> 说明：`src/` 用 ES Module 拆分成多文件便于维护；但浏览器 / Electron 的
> `file://` 协议不支持 ES Module 加载，故用 esbuild 打包成单文件 `dist/app.js`
> 供运行时加载。**改完 `src/` 里的代码后，需要重新 `npm run build` 才生效。**

## 运行（桌面版 Electron）

```bash
npm install       # 首次安装依赖
npm start         # 自动打包 src/ 并启动 Electron
```

## 打包安装包（Windows）

最简单的方式：直接双击项目根目录的 **`Pack.bat`**，它会自动完成
「清理残留 → 打包 src → 生成安装包 + 绿色包 → 清理临时文件」，全程有中文提示。

等效的命令行方式：

```bash
npm run dist      # 自动打包 src/ 并生成 release/ 下的 exe
```

> 打包产物在 `release/`：绿色包 `AuroraFM-Portable.exe`、安装包 `AuroraFM-Setup-1.0.0.exe`。
> 打包前请先关闭正在运行的 Aurora FM，否则旧进程会锁住文件导致失败。

## 浏览器 / 纯静态预览

```bash
npm run build                       # 先打包出 dist/app.js
python -m http.server 8000          # 或 npx serve .
```

然后浏览器打开 <http://localhost:8000>

## 移动端（Capacitor）

在 `mobile/` 目录：

```bash
cd mobile
node sync-www.js   # 同步 dist/app.js 等到 www/（需先 npm run build）
npm run sync       # 同步 + npx cap sync
```

> 注意：部分电台流依赖其所在地区的网络可达性；个别电台若连接失败会自动跳到下一台。
