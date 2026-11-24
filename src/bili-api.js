/* Aurora FM — 移动端 B站 / 播客接口
 * Capacitor 无 Electron 主进程代理，这里用 CapacitorHttp（原生 HTTP，绕过 CORS）
 * 复刻 main.js 中的 WBI 签名、搜索、视频解析与播客接口。
 */
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import md5 from "js-md5";

const BILI_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const BILI_HEADERS = {
  "User-Agent": BILI_UA,
  Referer: "https://www.bilibili.com/",
  Cookie: "buvid3=infoc",
};

const WBI_MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

const available = !!(
  Capacitor &&
  typeof Capacitor.isNativePlatform === "function" &&
  Capacitor.isNativePlatform() &&
  CapacitorHttp &&
  typeof CapacitorHttp.get === "function"
);

const stripTags = (s) => String(s || "").replace(/<[^>]+>/g, "");
const normalizePic = (p) => {
  const s = String(p || "");
  if (s.startsWith("//")) return "https:" + s;
  return s.replace(/^http:/, "https:");
};
const xmlUnescape = (s) =>
  String(s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
const xmlTag = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? xmlUnescape(m[1]) : "";
};
const parsePodcastDur = (s) => {
  s = String(s || "").trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return +s;
  const p = s.split(":").map(Number).reverse();
  return (p[0] || 0) + (p[1] || 0) * 60 + (p[2] || 0) * 3600;
};

async function getJson(url, headers = BILI_HEADERS) {
  const r = await CapacitorHttp.get({ url, headers, responseType: "json" });
  if (r.status >= 400) throw new Error(`网络请求失败 (${r.status})`);
  return r.data;
}

async function getText(url, headers = BILI_HEADERS) {
  const r = await CapacitorHttp.get({ url, headers, responseType: "text" });
  if (r.status >= 400) throw new Error(`网络请求失败 (${r.status})`);
  return String(r.data || "");
}

function wbiSign(params, imgKey, subKey) {
  const mixin = imgKey + subKey;
  const key = WBI_MIXIN_TAB.map((i) => mixin[i]).join("").slice(0, 32);
  const p = Object.assign({}, params, { wts: Math.floor(Date.now() / 1000) });
  const qs = Object.keys(p)
    .sort()
    .map(
      (k) =>
        `${k}=${encodeURIComponent(String(p[k])).replace(/[!'()*]/g, (c) =>
          "%" + c.charCodeAt(0).toString(16).toUpperCase()
        )}`
    )
    .join("&");
  p.w_rid = md5(qs + key);
  return new URLSearchParams(p).toString();
}

async function getWbiKeys() {
  const nav = await getJson("https://api.bilibili.com/x/web-interface/nav");
  const w = nav && nav.data && nav.data.wbi_img;
  if (!w) throw new Error("获取 B 站签名密钥失败");
  return {
    img: (w.img_url.split("/").pop() || "").split(".")[0],
    sub: (w.sub_url.split("/").pop() || "").split(".")[0],
  };
}

async function search(keyword, page = 1, mode = "video", order = "totalrank") {
  const kw = String(keyword || "").trim();
  if (!kw) return { items: [], total: 0 };
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
    const groups = new Map();
    for (const p of [1, 2]) {
      const qs = wbiSign(
        { search_type: "video", keyword: kw, page: p, page_size: 50, order: ord },
        img,
        sub
      );
      const res = await getJson(
        "https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs
      );
      if (res.code !== 0) {
        if (p === 1) throw new Error(res.message || `B 站搜索失败 code=${res.code}`);
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
    const list = [...groups.values()]
      .sort((a, b) => {
        const ba = (a.author.includes(kw) ? 100000 : 0) + a.count;
        const bb = (b.author.includes(kw) ? 100000 : 0) + b.count;
        return bb - ba;
      })
      .slice(0, 12);
    return { mode: "author", authors: list };
  }

  const qs = wbiSign(
    { search_type: "video", keyword: kw, page, page_size: 20, order: ord },
    img,
    sub
  );
  const res = await getJson(
    "https://api.bilibili.com/x/web-interface/wbi/search/type?" + qs
  );
  if (res.code !== 0) throw new Error(res.message || `B 站搜索失败 code=${res.code}`);
  const list = (res.data && res.data.result) || [];
  return {
    mode: "video",
    items: list.map(mapVideo),
    total: (res.data && res.data.numResults) || 0,
  };
}

async function resolve(bvid, page = 1) {
  const view = await getJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`
  );
  if (view.code !== 0) throw new Error(view.message || "获取视频信息失败");
  const d = view.data;
  const pages = (d.pages || []).map((p) => ({ page: p.page, part: p.part, cid: p.cid }));
  const cur = pages.find((p) => p.page === page) || pages[0];
  const play = await getJson(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cur.cid}&qn=16&platform=html5&high_quality=0`
  );
  if (play.code !== 0 || !play.data || !(play.data.durl || []).length) {
    throw new Error("获取音频流地址失败");
  }
  return {
    title: d.title,
    author: d.owner ? d.owner.name : "",
    pic: normalizePic(d.pic),
    duration: d.duration,
    pages,
    page: cur.page,
    stream: play.data.durl[0].url,
  };
}

async function podcastSearch(keyword) {
  const kw = String(keyword || "").trim();
  if (!kw) return { mode: "podcast", items: [] };
  const d = await getJson(
    `https://itunes.apple.com/search?term=${encodeURIComponent(kw)}&country=CN&media=podcast&limit=20`,
    { "User-Agent": BILI_UA, "Accept-Language": "zh-CN,zh;q=0.9" }
  );
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
}

async function podcastEpisodes(feedUrl, podcastInfo) {
  const u = String(feedUrl || "");
  if (!/^https?:\/\//i.test(u)) throw new Error("无效的播客地址");
  const info = podcastInfo || {};
  const xml = await getText(u, { "User-Agent": BILI_UA });
  const head = xml.split(/<item[\s>]/i)[0] || "";
  const podTitle = xmlTag(head, "title") || info.title || "";
  const podArtist = xmlTag(head, "itunes:author") || xmlTag(head, "author") || info.artist || "";
  let podArt = info.pic || "";
  const imgM =
    head.match(/<itunes:image[^>]*href="([^"]+)"/i) ||
    head.match(/<image[\s\S]*?<url>([\s\S]*?)<\/url>/i);
  if (imgM) podArt = xmlUnescape(imgM[1]);

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
    if (!enc) continue;
    const pubRaw = xmlTag(block, "pubDate");
    episodes.push({
      kind: "podcast",
      title: xmlTag(block, "title"),
      enclosure: enc,
      pubdate: Math.floor((Date.parse(pubRaw) || 0) / 1000),
      duration: parsePodcastDur(xmlTag(block, "itunes:duration") || xmlTag(block, "duration")),
      podTitle,
      artist: podArtist,
      pic: podArt,
    });
  }
  if (!episodes.length) throw new Error("未能解析出可播放的单集（可能全是付费内容）");
  return { podTitle, artist: podArtist, pic: podArt, episodes };
}

export const biliApi = {
  available,
  search,
  resolve,
  podcastSearch,
  podcastEpisodes,
};

export default biliApi;
