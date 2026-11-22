/* 同步桌面 Web 资源到 mobile/www（移动端无需 preload.js）
 * 运行时加载打包产物 dist/app.js（ES module 源码在 src/，需先 `node build.mjs` 打包）
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(__dirname, "www");
fs.mkdirSync(www, { recursive: true });

// 顶层文件
for (const f of ["index.html", "style.css", "mqtt-client.js"]) {
  fs.copyFileSync(path.join(root, f), path.join(www, f));
}

// 打包产物 dist/app.js（index.html 通过 <script src="dist/app.js"> 加载）
const distDir = path.join(root, "dist");
const distOut = path.join(www, "dist");
fs.mkdirSync(distOut, { recursive: true });
if (fs.existsSync(path.join(distDir, "app.js"))) {
  fs.copyFileSync(path.join(distDir, "app.js"), path.join(distOut, "app.js"));
} else {
  console.warn("⚠ 未找到 dist/app.js，请先在项目根目录运行 `node build.mjs`");
}

console.log("www synced:", fs.readdirSync(www).join(", "), "+ dist/app.js");
