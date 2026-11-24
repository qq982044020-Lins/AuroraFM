#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$ROOT/mobile"
IOS="$MOBILE/ios"
CONFIG="$MOBILE/capacitor.config.json"
PROJECT="$IOS/App/App.xcodeproj/project.pbxproj"
BUILD_DIR="$IOS/build/sim"
SIM_NAME="${1:-${SIM_NAME:-iPhone 16e}}"

for cmd in node npm xcodebuild xcrun; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "缺少命令: $cmd" >&2; exit 1; }
done
command -v pod >/dev/null 2>&1 || { echo "缺少 CocoaPods，请先运行: brew install cocoapods" >&2; exit 1; }

echo "[1/6] 检查前端依赖"
if [ ! -d "$ROOT/node_modules" ]; then
  (cd "$ROOT" && npm ci)
fi

echo "[2/6] 打包前端 dist/app.js"
(cd "$ROOT" && npm run build)

echo "[3/6] 检查移动端依赖"
if [ ! -d "$MOBILE/node_modules" ]; then
  (cd "$MOBILE" && npm ci)
fi

echo "[4/6] 同步 www 与 iOS 工程"
if [ -d "$IOS/App/build" ]; then
  xattr -w com.apple.xcode.CreatedByBuildSystem true "$IOS/App/build" 2>/dev/null || true
fi
(cd "$MOBILE" && node sync-www.js && npx cap sync ios)

echo "[5/6] 校准工程设置并编译模拟器版本"
node - "$CONFIG" "$PROJECT" <<'NODE'
const fs = require('fs');
const [configPath, projectPath] = process.argv.slice(2);
const appId = JSON.parse(fs.readFileSync(configPath, 'utf8')).appId;
let content = fs.readFileSync(projectPath, 'utf8');
content = content.replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;');
content = content.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);
fs.writeFileSync(projectPath, content);
console.log(`appId=${appId}, deploymentTarget=15.0`);
NODE

mkdir -p "$BUILD_DIR"
xcodebuild build \
  -workspace "$IOS/App/App.xcworkspace" \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=$SIM_NAME" \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO

APP_BUNDLE="$BUILD_DIR/Build/Products/Debug-iphonesimulator/App.app"
if [ ! -d "$APP_BUNDLE" ]; then
  echo "模拟器构建产物缺失: $APP_BUNDLE" >&2
  exit 1
fi

echo "[6/6] 启动模拟器并安装运行"
STATE="$(xcrun simctl list devices -j | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const d=JSON.parse(s); const name=process.argv[1];
  for (const runtimes of Object.values(d.devices)) {
    for (const dev of runtimes) if (dev.name===name) { process.stdout.write(dev.state); process.exit(0); }
  }
  process.stdout.write("NOT_FOUND");
})' "$SIM_NAME")"

if [ "$STATE" = "NOT_FOUND" ]; then
  echo "找不到模拟器: $SIM_NAME" >&2
  exit 1
fi
if [ "$STATE" != "Booted" ]; then
  xcrun simctl boot "$SIM_NAME"
  xcrun simctl bootstatus "$SIM_NAME" -b
fi

xcrun simctl install "$SIM_NAME" "$APP_BUNDLE"
APP_ID="$(node -p "require('$CONFIG').appId")"
PID="$(xcrun simctl launch "$SIM_NAME" "$APP_ID")"

echo "✅ 已安装并启动: $SIM_NAME"
echo "App: $APP_BUNDLE"
echo "Bundle ID: $APP_ID"
echo "PID: $PID"
