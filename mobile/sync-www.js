/* 同步桌面 Web 资源到 mobile/www（移动端无需 preload.js） */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(__dirname, "www");
fs.mkdirSync(www, { recursive: true });

for (const f of ["index.html", "style.css", "app.js"]) {
  fs.copyFileSync(path.join(root, f), path.join(www, f));
}
console.log("www synced:", fs.readdirSync(www).join(", "));
