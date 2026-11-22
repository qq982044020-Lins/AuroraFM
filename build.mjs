/* Aurora FM — 构建脚本（零配置，esbuild）
 * 把 src/ 下的 ES Module 源码打包成单个 IIFE 文件 dist/app.js，
 * 供 Electron(file://) / Capacitor(移动端) 运行时加载。
 * 源码保持 ES module 结构便于阅读维护，运行时加载打包产物。
 *
 * 用法：node build.mjs
 */
import { build } from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  outfile: "dist/app.js",
  format: "iife",          // 输出为浏览器可直接 <script> 加载的立即执行函数
  target: "es2020",
  charset: "utf8",
  logLevel: "info",
});

console.log("✅ 已打包为 dist/app.js");
