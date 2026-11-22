/* Aurora FM — quote.js
 * 温度金句栏：积极短句轮播（多种随机动效）。
 * 本地 150 条语料 + 一言(Hitokoto) API 混入，日期种子稳定排序，0 点刷新。
 */

import { els } from "./core.js";

const QUOTE_POOL = [
  "把日子过成诗，简单而精致。",
  "慢慢来，比较快。",
  "生活明朗，万物可爱，人间值得，未来可期。",
  "凡是过往，皆为序章；凡是未来，皆有可期。",
  "种一棵树最好的时间是十年前，其次是现在。",
  "心里有光，哪里都是方向。",
  "山不过来，我就过去。",
  "步履不停，终会抵达。",
  "你现在的努力，是未来的你看得见的底气。",
  "清醒时做事，糊涂时读书，独处时思考。",
  "日拱一卒，功不唐捐。",
  "把平凡的日子过出滋味，就是了不起的生活。",
  "允许一切发生，然后接住它。",
  "星光不问赶路人，时光不负有心人。",
  "热爱可抵岁月漫长。",
  "先努力优秀，再大方拥有。",
  "与其临渊羡鱼，不如退而结网。",
  "风会带走一切烦恼，也会带来新的开始。",
  "慢慢理解世界，慢慢更新自己。",
  "低头赶路，敬事如仪；抬头看天，自有山河。",
  "知足且上进，温柔而坚定。",
  "生活的最佳状态，是冷冷清清的风风火火。",
  "保持热爱，奔赴山海。",
  "所谓自由，不是随波逐流，而是有所选择。",
  "今天也要好好吃饭，好好睡觉，好好生活。",
  "一切发生皆有利于我。",
  "路虽远，行则将至；事虽难，做则必成。",
  "爱自己是终身浪漫的开始。",
  "读书、运动、早睡，是性价比最高的自我投资。",
  "花有重开日，人无再少年，此刻即最好。",
  "乐观的人，在每个困难里看到机会。",
  "你的时间花在哪里，你的人生就长成什么样。",
  "静下来，答案会自己浮出水面。",
  "世界很大，值得你慢慢去看。",
  "把今天过好，就是对未来最大的诚意。",
  "与其焦虑明天，不如做好今天。",
  "温和而有力量，谦逊而有锋芒。",
  "愿你眼里有光，心中有海，脚下有路。",
  "认真生活的人，运气不会太差。",
  "勇敢的人，先享受世界。",
  "所有的惊艳，都来自长久的积累。",
  "保持好奇心，永远年轻。",
  "允许自己做自己，允许别人做别人。",
  "别慌，月亮也正在大海某处迷茫。",
  "机会都藏在认真里。",
  "日落归山海，山海藏深意。",
  "小步快走，也是一种浪漫。",
  "每一个不曾起舞的日子，都是对生命的辜负。",
  "心怀感恩，所见皆温柔。",
  "身体和灵魂，总要有一个在路上。",
  "春有百花秋有月，夏有凉风冬有雪。",
  "行到水穷处，坐看云起时。",
  "莫听穿林打叶声，何妨吟啸且徐行。",
  "竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。",
  "回首向来萧瑟处，归去，也无风雨也无晴。",
  "长风破浪会有时，直挂云帆济沧海。",
  "沉舟侧畔千帆过，病树前头万木春。",
  "问渠那得清如许？为有源头活水来。",
  "纸上得来终觉浅，绝知此事要躬行。",
  "不畏浮云遮望眼，自缘身在最高层。",
  "千磨万击还坚劲，任尔东西南北风。",
  "宝剑锋从磨砺出，梅花香自苦寒来。",
  "山重水复疑无路，柳暗花明又一村。",
  "会当凌绝顶，一览众山小。",
  "天生我材必有用，千金散尽还复来。",
  "勿以善小而不为，勿以恶小而为之。",
  "静以修身，俭以养德。",
  "非淡泊无以明志，非宁静无以致远。",
  "博学之，审问之，慎思之，明辨之，笃行之。",
  "天行健，君子以自强不息。",
  "地势坤，君子以厚德载物。",
  "岁寒，然后知松柏之后凋也。",
  "知者不惑，仁者不忧，勇者不惧。",
  "见贤思齐焉，见不贤而内自省也。",
  "三人行，必有我师焉。",
  "逝者如斯夫，不舍昼夜。",
  "吾生也有涯，而知也无涯。",
  "独学而无友，则孤陋而寡闻。",
  "玉不琢，不成器；人不学，不知道。",
  "业精于勤，荒于嬉；行成于思，毁于随。",
  "尺有所短，寸有所长。",
  "临渊羡鱼，不如退而结网。",
  "精诚所至，金石为开。",
  "绳锯木断，水滴石穿。",
  "千里之行，始于足下。",
  "胜人者有力，自胜者强。",
  "知人者智，自知者明。",
  "大直若屈，大巧若拙，大辩若讷。",
  "祸兮福之所倚，福兮祸之所伏。",
  "合抱之木，生于毫末；九层之台，起于累土。",
  "圣人无常心，以百姓心为心。",
  "上善若水，水善利万物而不争。",
  "夫唯不争，故天下莫能与之争。",
  "大道至简，知易行难。",
  "君子藏器于身，待时而动。",
  "穷则变，变则通，通则久。",
  "二人同心，其利断金。",
  "满招损，谦受益。",
  "良药苦口利于病，忠言逆耳利于行。",
  "有志者，事竟成。",
  "老骥伏枥，志在千里；烈士暮年，壮心不已。",
  "非学无以广才，非志无以成学。",
  "静水流深，沧笙踏歌。",
  "心之所向，素履以往。",
  "生如逆旅，一苇以航。",
  "愿历尽千帆，归来仍是少年。",
  "腹有诗书气自华。",
  "人生如逆旅，我亦是行人。",
  "此心安处，便是吾乡。",
  "休对故人思故国，且将新火试新茶。",
  "诗酒趁年华。",
  "一蓑烟雨任平生，也无风雨也无晴。",
  "人生自是有情痴，此恨不关风与月。",
  "最是人间留不住，朱颜辞镜花辞树，所以要珍惜当下。",
  "自是花中第一流。",
  "何须浅碧深红色，自是花中第一流。",
  "点点梅花，皆是傲骨。",
  "夜来风雨声，花落知多少，落花亦是新生。",
  "随风潜入夜，润物细无声。",
  "会当水击三千里，自信人生二百年。",
  "横眉冷对千夫指，俯首甘为孺子牛。",
  "其实地上本没有路，走的人多了，也便成了路。",
  "愿中国青年都摆脱冷气，只是向上走。",
  "有一分热，发一分光。",
  "此后如竟没有炬火，我便是唯一的光。",
  "改造自己，总比禁止别人来得难。",
  "时间就像海绵里的水，只要愿挤，总还是有的。",
];

const QUOTE_DAILY_COUNT = 50;
const QUOTE_API = "https://v1.hitokoto.cn/?c=d&c=i&c=k&c=e&max_length=30";
const QUOTE_FX = ["up", "side", "fade", "pixel", "type", "flip"];
let dailyQuotes = [];
let dailyApiQuotes = [];
let quoteIdx = -1;
let quoteDayKey = "";
let quoteTimer = null;
let quoteRollTimer = null;
let quoteBusy = false;

function quoteDayKeyOf(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
function seedFromKey(key) {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function fetchQuoteApi() {
  const tasks = Array.from({ length: 15 }, () =>
    fetch(QUOTE_API).then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.hitokoto) ? String(j.hitokoto).trim() : null)
      .catch(() => null)
  );
  const rs = await Promise.allSettled(tasks);
  const out = [];
  for (const r of rs) if (r.status === "fulfilled" && r.value) out.push(r.value);
  return [...new Set(out)];
}
function buildDailyQuotes(apiExtra) {
  const rnd = mulberry32(seedFromKey(quoteDayKey));
  const merged = [...(apiExtra || []), ...QUOTE_POOL];
  const seen = new Set(), uniq = [];
  for (const q of merged) { if (q && !seen.has(q)) { seen.add(q); uniq.push(q); } }
  dailyQuotes = shuffleWith(uniq, rnd).slice(0, QUOTE_DAILY_COUNT);
}
function startQuoteDay(withApi) {
  quoteDayKey = quoteDayKeyOf();
  buildDailyQuotes(withApi ? dailyApiQuotes : []);
  quoteIdx = -1;
  showQuote();
  restartQuoteTimer();
}
function rollQuoteDay() {
  if (quoteDayKeyOf() === quoteDayKey) return;
  startQuoteDay(false);
  fetchQuoteApi().then((api) => {
    if (api.length && quoteDayKeyOf() === quoteDayKey) {
      dailyApiQuotes = api;
      buildDailyQuotes(api);
    }
  });
}
quoteRollTimer = setInterval(rollQuoteDay, 30000);

function clearFx(el) {
  el.classList.remove("fx-up-in", "fx-up-out", "fx-side-in", "fx-side-out",
    "fx-fade-in", "fx-fade-out", "fx-pixel-in", "fx-pixel-out", "fx-flip-in", "fx-flip-out");
}
function spawnOut(text, fx) {
  const stage = els.quoteText.parentElement;
  const out = document.createElement("div");
  out.className = "quote-text fx-" + fx + "-out";
  out.textContent = text;
  stage.appendChild(out);
  setTimeout(() => out.remove(), 700);
}
function typewriterIn(text) {
  els.quoteText.textContent = "";
  els.quoteText.classList.add("typing");
  let i = 0;
  const t = setInterval(() => {
    els.quoteText.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(t);
      setTimeout(() => els.quoteText.classList.remove("typing"), 600);
    }
  }, 55);
}
function showQuote(manual) {
  if (quoteBusy) return;
  quoteBusy = true;
  const fx = QUOTE_FX[Math.floor(Math.random() * QUOTE_FX.length)];
  const oldText = els.quoteText.textContent;
  if (!dailyQuotes.length) dailyQuotes = QUOTE_POOL.slice(0, QUOTE_DAILY_COUNT);
  quoteIdx = (quoteIdx + 1) % dailyQuotes.length;
  const text = dailyQuotes[quoteIdx];
  if (fx === "type") {
    if (oldText) spawnOut(oldText, "fade");
    typewriterIn(text);
  } else {
    if (oldText) spawnOut(oldText, fx);
    clearFx(els.quoteText);
    void els.quoteText.offsetWidth;
    els.quoteText.classList.add("fx-" + fx + "-in");
    els.quoteText.textContent = text;
  }
  if (manual) restartQuoteTimer();
  setTimeout(() => { clearFx(els.quoteText); quoteBusy = false; }, 750);
}
function restartQuoteTimer() {
  clearInterval(quoteTimer);
  quoteTimer = setInterval(showQuote, 10000);
}
els.quoteBar.addEventListener("click", () => showQuote(true));
els.quoteNext.addEventListener("click", (e) => { e.stopPropagation(); showQuote(true); });

startQuoteDay(false);
fetchQuoteApi().then((api) => {
  dailyApiQuotes = api;
  buildDailyQuotes(api);
});

const api = {
  cleanup: () => {
    clearInterval(quoteTimer);
    clearInterval(quoteRollTimer);
  },
};

export default api;
