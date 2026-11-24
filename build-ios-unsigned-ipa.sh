#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE="$ROOT/mobile"
IOS="$MOBILE/ios"
CONFIG="$MOBILE/capacitor.config.json"
PROJECT="$IOS/App/App.xcodeproj/project.pbxproj"
BUILD_DIR="$IOS/build"
ARCHIVE="$BUILD_DIR/App-unsigned.xcarchive"
IPA="$BUILD_DIR/AuroraFM-unsigned.ipa"

for cmd in node npm xcodebuild zip; do
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

echo "[5/6] 校准 Xcode 工程设置"
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

echo "[6/6] 生成无签名归档与 IPA"
mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE" "$BUILD_DIR/Payload" "$IPA"
xcodebuild archive \
  -workspace "$IOS/App/App.xcworkspace" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO

APP_BUNDLE="$ARCHIVE/Products/Applications/App.app"
if [ ! -d "$APP_BUNDLE" ]; then
  echo "归档产物缺失: $APP_BUNDLE" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR/Payload/Payload"
cp -R "$APP_BUNDLE" "$BUILD_DIR/Payload/Payload/"
(cd "$BUILD_DIR/Payload" && zip -qr "$IPA" Payload)

echo "✅ 无签名 IPA 已生成: $IPA"
ls -lh "$IPA"
shasum "$IPA"
