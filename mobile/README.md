# Aurora FM 移动端（Capacitor）

桌面版 Web 代码（`index.html / style.css / app.js`）由 `sync-www.js` 复制到 `www/`，
Capacitor 把它包装成原生 App。

## 产物

- **Android APK**：`AuroraFM-手机版.apk`（Debug 签名，可直接传到手机安装）
- **iOS 工程**：`ios/App.xcworkspace`（需 Mac + Xcode 打包 IPA）

## 常用命令（在本目录执行）

```bash
npm run sync      # 桌面代码改动后同步到 www 并刷新两个平台
npm run android   # 同步并重新编译 APK（使用 d:\gradle\gradle-8.2.1）
```

## 环境说明

- Android SDK 位于 `d:\android-sdk`（platform-tools / platforms;android-34 / build-tools;34.0.0）
- Gradle 位于 `d:\gradle\gradle-8.2.1`（Maven 依赖走阿里云镜像）
- `android/local.properties` 已指向 SDK

## 与桌面版的差异

- 无自定义标题栏按钮（使用系统状态栏）；全屏屏保以覆盖层方式实现，功能一致
- 本机弹幕房间服务（WebSocket）是桌面独占功能，手机端自动隐藏弹幕入口与在线人数
- 收音机流为 http 协议，已在 `capacitor.config.json` 开启 `allowMixedContent`

## iOS 打包（需要一台 Mac）

1. 把 `mobile/` 目录整个拷到 Mac
2. `cd mobile && npm install && npx cap sync ios`
3. `cd ios && pod install`（需要 CocoaPods）
4. 用 Xcode 打开 `App.xcworkspace`，配置签名团队后 Product → Archive 导出 IPA

> iOS 无法在 Windows 上构建，这是苹果的工具链限制（Xcode 仅限 macOS）。
